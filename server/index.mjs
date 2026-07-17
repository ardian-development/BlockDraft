import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { URL } from "node:url";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(new URL("../.env.local", import.meta.url));

const port = Number(process.env.API_PORT ?? 8787);
const host = process.env.API_HOST ?? "0.0.0.0";
const promptModel = process.env.GEMINI_PROMPT_MODEL ?? "gemini-3.1-flash-lite";
const voxelModel = process.env.GEMINI_VOXEL_MODEL ?? process.env.GEMINI_OBJECT_MODEL ?? "gemini-3-flash-preview";
const apiKey = process.env.GEMINI_API_KEY;
const modes = ["architecture", "object", "character", "vehicle", "pixel_art"];
const allowedModels = ["gemini-3-flash-preview", "gemini-3-flash", "gemini-3.1-flash", "gemini-3.1-pro", "gemini-3.5-flash"];
const MAX_BLOCKS = 5_000;

const explicitVoxelSchema = {
  type: "object",
  properties: {
    schemaVersion: { type: "string", enum: ["3.0"] },
    name: { type: "string" },
    mode: { type: "string", enum: modes },
    bounds: {
      type: "object",
      properties: { x: { type: "integer" }, y: { type: "integer" }, z: { type: "integer" } },
      required: ["x", "y", "z"],
    },
    palette: { type: "array", items: { type: "string" } },
    focalFeatures: { type: "array", items: { type: "string" } },
    structure: { type: "array", items: { type: "array", items: { type: "integer" } } },
  },
  required: ["schemaVersion", "name", "mode", "bounds", "palette", "focalFeatures", "structure"],
};

const promptBriefSchema = {
  type: "object",
  properties: {
    optimizedPrompt: { type: "string" },
    subject: { type: "string" },
    silhouette: { type: "string" },
    palette: { type: "array", items: { type: "string" } },
    focalFeatures: { type: "array", items: { type: "string" } },
    orientation: { type: "string" },
    buildConstraints: { type: "array", items: { type: "string" } },
  },
  required: ["optimizedPrompt", "subject", "silhouette", "palette", "focalFeatures", "orientation", "buildConstraints"],
};

const partPlanSchema = {
  type: "object",
  properties: {
    schemaVersion: { type: "string", enum: ["1.0"] },
    name: { type: "string" },
    mode: { type: "string", enum: modes },
    bounds: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" }, z: { type: "integer" } }, required: ["x", "y", "z"] },
    palette: { type: "array", items: { type: "string" } },
    focalFeatures: { type: "array", items: { type: "string" } },
    parts: { type: "array", items: {
      type: "object",
      properties: {
        id: { type: "string" }, role: { type: "string" },
        shape: { type: "string", enum: ["box", "ellipsoid", "cylinder", "cone", "wedge"] },
        center: { type: "array", items: { type: "integer" } },
        size: { type: "array", items: { type: "integer" } },
        materialIndex: { type: "integer" }, hollow: { type: "boolean" },
      },
      required: ["id", "role", "shape", "center", "size", "materialIndex"],
    } },
  },
  required: ["schemaVersion", "name", "mode", "bounds", "palette", "focalFeatures", "parts"],
};

function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
  });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 12_000_000) reject(new Error("Request body too large. Use an image up to 8 MB."));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function integer(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function extractJson(text) {
  const trimmed = String(text ?? "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
  try { return JSON.parse(candidate); } catch {
    const repaired = candidate.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(repaired);
  }
}

function detectMode(prompt) {
  const text = String(prompt || "").toLowerCase();
  if (/\b(car|truck|vehicle|airplane|aircraft|jet|helicopter|ship|boat|rocket|bus|train|motorcycle)\b/.test(text)) return "vehicle";
  if (/\b(pixel art|pixel-art|sprite|8-bit|16-bit)\b/.test(text)) return "pixel_art";
  if (/\b(house|castle|tower|building|bridge|temple|church|cathedral|pyramid|fortress|wall|gate|arch|dome|cabin|cottage|palace|mansion|barn|lighthouse|monument|skyscraper|hut|shrine|mosque|windmill|mill|farm|fountain|pool|well|pier|dock|harbor|station|garage|warehouse|shop|store|market|school|library|hospital|prison|dungeon|arena|fort|tavern|inn|villa|bunker|shelter|igloo|pagoda|minaret|obelisk|stable|silo|greenhouse|gazebo|pavilion|amphitheatre|colosseum|aqueduct)\b/.test(text)) return "architecture";
  if (/\b(object|prop|ball|soccer|soccerball|football|sword|chair|table|lamp|guitar|tool|chest|hat|helmet|statue|figure|flower|tree|logo|flag|banner|sign|symbol|emblem)\b/.test(text)) return "object";
  // Default to character — most creative prompts describe living/animated
  // subjects (characters, animals, creatures, fictional beings) rather than
  // buildings. Architecture is caught by its own keyword list above.
  return "character";
}

function safeBlockId(value, fallback = "minecraft:stone") {
  const candidate = String(value || "").trim().toLowerCase();
  if (/^minecraft:[a-z0-9_./-]+$/.test(candidate)) return candidate;
  if (/^(?:[a-z0-9]+_)*(?:concrete|wool|terracotta|planks|bricks|glass|stone|wood|log|block|lantern|slab|stairs|leaves|ice|snow|obsidian|sand)$/.test(candidate)) return `minecraft:${candidate}`;
  const aliases = {
    red: "minecraft:red_concrete", yellow: "minecraft:yellow_concrete", orange: "minecraft:orange_concrete",
    blue: "minecraft:blue_concrete", green: "minecraft:green_concrete", white: "minecraft:white_concrete",
    black: "minecraft:black_concrete", gray: "minecraft:gray_concrete", grey: "minecraft:gray_concrete",
    brown: "minecraft:brown_concrete", purple: "minecraft:purple_concrete", pink: "minecraft:pink_concrete",
    cyan: "minecraft:cyan_concrete", lime: "minecraft:lime_concrete", gold: "minecraft:gold_block",
    "#ff0000": "minecraft:red_concrete", "#ffff00": "minecraft:yellow_concrete", "#ffa500": "minecraft:orange_concrete",
    "#0000ff": "minecraft:blue_concrete", "#ffffff": "minecraft:white_concrete", "#000000": "minecraft:black_concrete",
  };
  return aliases[candidate] || fallback;
}

function requestedColors(prompt) {
  const definitions = [
    ["light blue", "minecraft:light_blue_concrete"], ["dark blue", "minecraft:blue_concrete"],
    ["yellow", "minecraft:yellow_concrete"], ["orange", "minecraft:orange_concrete"],
    ["red", "minecraft:red_concrete"], ["blue", "minecraft:blue_concrete"],
    ["green", "minecraft:green_concrete"], ["lime", "minecraft:lime_concrete"],
    ["purple", "minecraft:purple_concrete"], ["magenta", "minecraft:magenta_concrete"],
    ["pink", "minecraft:pink_concrete"], ["cyan", "minecraft:cyan_concrete"],
    ["brown", "minecraft:brown_concrete"], ["black", "minecraft:black_concrete"],
    ["white", "minecraft:white_concrete"], ["gray", "minecraft:gray_concrete"], ["grey", "minecraft:gray_concrete"],
  ];
  const text = String(prompt || "").toLowerCase();
  return definitions.filter(([name]) => new RegExp(`\\b${name.replace(" ", "\\s+")}\\b`).test(text)).map(([, block]) => block).filter((block, index, all) => all.indexOf(block) === index);
}

function largestConnectedStructure(structure) {
  const map = new Map(structure.map((entry) => [`${entry[0]},${entry[1]},${entry[2]}`, entry]));
  const unseen = new Set(map.keys());
  const components = [];
  const directions = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  while (unseen.size) {
    const first = unseen.values().next().value;
    const queue = [first];
    const component = [];
    unseen.delete(first);
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      const entry = map.get(current);
      component.push(entry);
      for (const [dx, dy, dz] of directions) {
        const neighbor = `${entry[0] + dx},${entry[1] + dy},${entry[2] + dz}`;
        if (unseen.delete(neighbor)) queue.push(neighbor);
      }
    }
    components.push(component);
  }
  components.sort((a, b) => b.length - a.length);
  return { structure: components[0] ?? [], removed: components.slice(1).reduce((sum, component) => sum + component.length, 0), components: components.length };
}

function bridgeDisconnectedStructure(structure, bounds) {
  const result = new Map(structure.map((entry) => [`${entry[0]},${entry[1]},${entry[2]}`, entry]));
  let bridged = 0;
  for (let round = 0; round < 12; round++) {
    const groups = largestConnectedStructure([...result.values()]);
    if (groups.components <= 1) break;
    const all = [...result.values()];
    const mainKeys = new Set(groups.structure.map(([x, y, z]) => `${x},${y},${z}`));
    const secondary = all.filter(([x, y, z]) => !mainKeys.has(`${x},${y},${z}`));
    let bestA = groups.structure[0], bestB = secondary[0], bestDistance = Infinity;
    for (const a of groups.structure) for (const b of secondary) {
      const distance = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
      if (distance < bestDistance) { bestDistance = distance; bestA = a; bestB = b; }
    }
    if (!bestA || !bestB) break;
    let [x, y, z] = bestA;
    const [tx, ty, tz] = bestB;
    const steps = [["x", tx], ["y", ty], ["z", tz]];
    for (const [axis, target] of steps) {
      while ({ x, y, z }[axis] !== target) {
        if (axis === "x") x += Math.sign(target - x);
        if (axis === "y") y += Math.sign(target - y);
        if (axis === "z") z += Math.sign(target - z);
        if (x >= 0 && y >= 0 && z >= 0 && x < bounds.x && y < bounds.y && z < bounds.z) {
          const key = `${x},${y},${z}`;
          if (!result.has(key)) { result.set(key, [x, y, z, bestA[3]]); bridged++; }
        }
      }
    }
  }
  return { structure: [...result.values()], bridged };
}

function normalizeExplicitSpec(raw, prompt, requestedMode, size) {
  if (!raw || typeof raw !== "object") throw new Error("Gemini returned no explicit voxel object.");
  const bounds = {
    x: integer(raw.bounds?.x, 16, 1, 32),
    y: integer(raw.bounds?.y, 16, 1, 32),
    z: integer(raw.bounds?.z, 16, 1, 32),
  };
  let palette = (Array.isArray(raw.palette) ? raw.palette : []).slice(0, 12).map((value) => safeBlockId(value));
  palette = palette.filter((value, index, all) => all.indexOf(value) === index);
  if (!palette.length) palette = ["minecraft:stone"];
  const colors = requestedColors(prompt);
  if (colors[0] && !palette.includes(colors[0])) palette[0] = colors[0];
  for (const color of colors.slice(1)) if (!palette.includes(color) && palette.length < 12) palette.push(color);

  const deduplicated = new Map();
  let rejected = 0;
  for (const entry of Array.isArray(raw.structure) ? raw.structure : []) {
    if (!Array.isArray(entry) || entry.length < 4) { rejected++; continue; }
    const x = Number(entry[0]), y = Number(entry[1]), z = Number(entry[2]), material = Number(entry[3]);
    if (![x, y, z, material].every(Number.isInteger) || x < 0 || y < 0 || z < 0 || x >= bounds.x || y >= bounds.y || z >= bounds.z || material < 0 || material >= palette.length) { rejected++; continue; }
    deduplicated.set(`${x},${y},${z}`, [x, y, z, material]);
  }
  let structure = [...deduplicated.values()];
  if (structure.length > MAX_BLOCKS) throw new Error(`Gemini returned ${structure.length.toLocaleString("en-US")} voxels; the explicit quality budget is ${MAX_BLOCKS.toLocaleString("en-US")}.`);
  const minimumBlocks = requestedMode === "pixel_art"
    ? 100
    : requestedMode === "architecture"
      ? (size === "large" ? 600 : size === "small" ? 120 : 300)
      : (size === "large" ? 400 : size === "small" ? 50 : 150);
  if (structure.length < minimumBlocks) throw new Error(`Gemini returned only ${structure.length} voxels; at least ${minimumBlocks} are required for the selected quality level.`);

  // Bridge any disconnected parts before the final connectivity filter.
  // This rescues appendages (ears, arms, feet) that ended up with a small
  // gap after compilation and bound-clamping, preventing them from being
  // silently removed by the largest-component filter below.
  const preBridge = bridgeDisconnectedStructure(structure, bounds);
  structure = preBridge.structure;
  const connected = largestConnectedStructure(structure);
  structure = connected.structure.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2]);
  if (structure.length < minimumBlocks) throw new Error("The generated voxels did not form a sufficiently detailed connected model.");

  const used = [...new Set(structure.map((entry) => entry[3]))].sort((a, b) => a - b);
  const remap = new Map(used.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  palette = used.map((index) => palette[index]);
  structure = structure.map(([x, y, z, material]) => [x, y, z, remap.get(material)]);
  const usage = Object.fromEntries(palette.map((block, index) => [block, structure.filter((entry) => entry[3] === index).length]));
  const missingRequestedColors = colors.filter((color) => !usage[color]);
  const eyeColorMatch = String(prompt || "").toLowerCase().match(/\b(light\s+blue|dark\s+blue|yellow|orange|red|blue|green|lime|purple|magenta|pink|cyan|brown|black|white|gray|grey)\s+eyes?\b/);
  if (eyeColorMatch) {
    const eyeBlock = requestedColors(eyeColorMatch[0])[0];
    const eyeMaterial = palette.indexOf(eyeBlock);
    const eyeVoxels = structure.filter(([, , , material]) => material === eyeMaterial);
    const eyeByKey = new Map(eyeVoxels.map((voxel) => [`${voxel[0]},${voxel[1]},${voxel[2]}`, voxel]));
    const visitedEyes = new Set();
    const eyeClusters = [];
    for (const seed of eyeVoxels) {
      const seedKey = `${seed[0]},${seed[1]},${seed[2]}`;
      if (visitedEyes.has(seedKey)) continue;
      const queue = [seed];
      const cluster = [];
      visitedEyes.add(seedKey);
      while (queue.length) {
        const current = queue.pop();
        cluster.push(current);
        const [x, y, z] = current;
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const key = `${x + dx},${y + dy},${z + dz}`;
          if (!visitedEyes.has(key) && eyeByKey.has(key)) {
            visitedEyes.add(key);
            const next = eyeByKey.get(key);
            if (next) queue.push(next);
          }
        }
      }
      eyeClusters.push(cluster);
    }
    const centerX = (bounds.x - 1) / 2;
    const smallUpperFrontClusters = eyeClusters.map((cluster) => {
      const centroid = cluster.reduce((sum, [x, y, z]) => [sum[0] + x, sum[1] + y, sum[2] + z], [0, 0, 0]).map((sum) => sum / cluster.length);
      return { cluster, centroid };
    }).filter(({ cluster, centroid }) => cluster.length <= 8 && centroid[1] >= bounds.y * 0.65 && centroid[2] >= bounds.z * 0.5);
    const hasPair = smallUpperFrontClusters.some(({ centroid }) => centroid[0] < centerX)
      && smallUpperFrontClusters.some(({ centroid }) => centroid[0] > centerX);
    if (eyeMaterial < 0 || smallUpperFrontClusters.length < 2 || !hasPair) throw new Error(`The candidate did not contain two small, separated ${eyeColorMatch[1]} eye clusters on the front of the face.`);
  }
  return {
    spec: {
      schemaVersion: "3.0",
      name: String(raw.name || "Explicit voxel model").slice(0, 100),
      mode: requestedMode,
      bounds,
      palette,
      focalFeatures: (Array.isArray(raw.focalFeatures) ? raw.focalFeatures : []).slice(0, 10).map((value) => String(value).slice(0, 120)),
      structure,
    },
    qualityReport: { rejected, detachedRemoved: connected.removed, connectedComponents: connected.components, blockCount: structure.length, materialUsage: usage, missingRequestedColors },
  };
}

function normalizePromptBrief(raw, originalPrompt, mode) {
  if (!raw || typeof raw !== "object" || !String(raw.optimizedPrompt || "").trim()) return null;
  const list = (value, limit) => Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, limit) : [];
  return {
    optimizedPrompt: String(raw.optimizedPrompt).slice(0, 1600), subject: String(raw.subject || originalPrompt).slice(0, 160),
    silhouette: String(raw.silhouette || "clear connected silhouette").slice(0, 320), palette: list(raw.palette, 8),
    focalFeatures: list(raw.focalFeatures, 10), orientation: "canonical: upright +Y, front/face toward +Z, left/right across X",
    buildConstraints: list(raw.buildConstraints, 8), mode,
  };
}

function compilePartPlan(plan, mode, prompt, size) {
  const bounds = {
    x: integer(plan?.bounds?.x, 16, 1, 32), y: integer(plan?.bounds?.y, 16, 1, 32), z: integer(plan?.bounds?.z, 16, 1, 32),
  };
  let palette = Array.isArray(plan?.palette) ? plan.palette.slice(0, 12).map((value) => safeBlockId(value)) : ["minecraft:stone"];
  if (!palette.length) palette = ["minecraft:stone"];
  const roleMaterial = (role) => {
    const text = String(role || "").toLowerCase();
    if (/eye|pupil/.test(text)) {
      const request = String(prompt || "").toLowerCase();
      if (/yellow\s+eyes?/.test(request)) return "minecraft:yellow_concrete";
      if (/blue\s+eyes?/.test(request)) return "minecraft:blue_concrete";
      if (/green\s+eyes?/.test(request)) return "minecraft:green_concrete";
      if (/red\s+eyes?/.test(request)) return "minecraft:red_concrete";
      return "minecraft:black_concrete";
    }
    if (/beak|bill|orange/.test(text)) return "minecraft:orange_concrete";
    if (/window|glass/.test(text)) return "minecraft:glass";
    if (/roof|dark|trim/.test(text)) return "minecraft:dark_oak_planks";
    if (/wood|beam|door|tail|wing/.test(text)) return "minecraft:oak_planks";
    if (/gold|accent|yellow/.test(text)) return "minecraft:yellow_concrete";
    return null;
  };
  for (const part of Array.isArray(plan?.parts) ? plan.parts : []) {
    const material = roleMaterial(part?.role);
    if (material && !palette.includes(material) && palette.length < 12) palette.push(material);
  }
  // Gemini can occasionally return only a focal detail (for example a beak or
  // one wing). Always provide a deterministic primary volume so a valid but
  // incomplete plan cannot reach the renderer.
  const rawParts = Array.isArray(plan?.parts) ? plan.parts.slice(0, 96) : [];
  const hasCore = rawParts.some((part) => /body|torso|main|core|base|building|structure|vehicle|airframe|ball|sphere/.test(String(part?.role || "").toLowerCase()));
  const fallbackSize = size === "small" ? 0.58 : size === "large" ? 0.64 : 0.61;
  const completeParts = hasCore ? rawParts : [{
    id: "auto-primary-volume", role: mode === "architecture" ? "main structure" : "body core",
    shape: "ellipsoid", center: [Math.floor(bounds.x / 2), Math.floor(bounds.y * 0.48), Math.floor(bounds.z / 2)],
    size: [Math.max(3, Math.floor(bounds.x * fallbackSize)), Math.max(3, Math.floor(bounds.y * fallbackSize)), Math.max(3, Math.floor(bounds.z * fallbackSize))], materialIndex: 0, hollow: false,
  }, ...rawParts];
  const structures = new Map();
  const put = (x, y, z, materialIndex) => {
    if (x < 0 || y < 0 || z < 0 || x >= bounds.x || y >= bounds.y || z >= bounds.z) return;
    if (materialIndex < 0 || materialIndex >= palette.length) return;
    structures.set(`${x},${y},${z}`, [x, y, z, materialIndex]);
  };
  const parts = completeParts;
  for (const part of parts) {
    const shape = ["box", "ellipsoid", "cylinder", "cone", "wedge"].includes(part?.shape) ? part.shape : "box";
    const center = Array.isArray(part?.center) ? part.center.map(Number) : [0, 0, 0];
    const sizeValues = Array.isArray(part?.size) ? part.size.map(Number) : [1, 1, 1];
    const cx = integer(center[0], 0, 0, 31), cy = integer(center[1], 0, 0, 31), cz = integer(center[2], 0, 0, 31);
    const sx = integer(sizeValues[0], 1, 1, 32), sy = integer(sizeValues[1], 1, 1, 32), sz = integer(sizeValues[2], 1, 1, 32);
    const roleBlock = roleMaterial(part?.role);
    const roleIndex = roleBlock ? palette.indexOf(roleBlock) : -1;
    const material = roleIndex >= 0 ? roleIndex : integer(part?.materialIndex, 0, 0, Math.max(0, palette.length - 1));
    const minX = Math.floor(cx - sx / 2), maxX = Math.ceil(cx + sx / 2) - 1;
    const minY = Math.floor(cy - sy / 2), maxY = Math.ceil(cy + sy / 2) - 1;
    const minZ = Math.floor(cz - sz / 2), maxZ = Math.ceil(cz + sz / 2) - 1;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const nx = (x - cx) / Math.max(0.5, sx / 2), ny = (y - cy) / Math.max(0.5, sy / 2), nz = (z - cz) / Math.max(0.5, sz / 2);
      let inside = true;
      if (shape === "ellipsoid") inside = nx * nx + ny * ny + nz * nz <= 1.08;
      if (shape === "cylinder") inside = nx * nx + nz * nz <= 1.08;
      if (shape === "cone") inside = nx * nx + nz * nz <= Math.max(0, (1 - (y - minY) / Math.max(1, sy - 1))) ** 2 * 1.08;
      if (shape === "wedge") inside = Math.abs(nx) <= Math.max(0, 1 - Math.abs(ny));
      if (!inside) continue;
      const edge = x === minX || x === maxX || y === minY || y === maxY || z === minZ || z === maxZ;
      if (part.hollow && !edge) continue;
      put(x, y, z, material);
    }
  }
  // Characters, animals and most props/vehicles are expected to have a
  // bilateral silhouette. Gemini occasionally places only the left or right
  // half of a body. Detect that case and complete the weaker side locally;
  // architecture is intentionally excluded because asymmetry is common there.
  if (mode !== "architecture" && structures.size > 24) {
    let left = 0, right = 0;
    const mid = (bounds.x - 1) / 2;
    for (const [key] of structures) {
      const x = Number(key.split(",")[0]);
      if (x < mid) left++; else if (x > mid) right++;
    }
    const smaller = Math.min(left, right), larger = Math.max(left, right);
    if (smaller < larger * 0.72) {
      const snapshot = [...structures.values()];
      for (const [x, y, z, material] of snapshot) {
        const mirroredX = bounds.x - 1 - x;
        if ((left < right && x > mid) || (right < left && x < mid)) put(mirroredX, y, z, material);
      }
    }
  }
  const minimumBlocks = mode === "pixel_art" ? 100 : mode === "architecture" ? (size === "large" ? 600 : size === "small" ? 120 : 300) : (size === "large" ? 1_000 : size === "small" ? 300 : 600);
  if (structures.size < minimumBlocks) {
    const material = 0;
    const cx = Math.floor(bounds.x / 2), cy = Math.floor(bounds.y * 0.48), cz = Math.floor(bounds.z / 2);
    let sx = Math.max(3, Math.floor(bounds.x * fallbackSize)), sy = Math.max(3, Math.floor(bounds.y * fallbackSize)), sz = Math.max(3, Math.floor(bounds.z * fallbackSize));
    // Grow the connected primary volume until the selected quality tier is
    // reachable. This prevents valid-but-tiny Gemini plans from becoming 500
    // errors while keeping the model inside the configured bounds.
    for (let pass = 0; pass < 8 && structures.size < minimumBlocks; pass++, sx++, sy++, sz++) {
      for (let y = Math.floor(cy - sy / 2); y < Math.ceil(cy + sy / 2); y++) for (let x = Math.floor(cx - sx / 2); x < Math.ceil(cx + sx / 2); x++) for (let z = Math.floor(cz - sz / 2); z < Math.ceil(cz + sz / 2); z++) {
        const nx = (x - cx) / Math.max(0.5, sx / 2), ny = (y - cy) / Math.max(0.5, sy / 2), nz = (z - cz) / Math.max(0.5, sz / 2);
        if (nx * nx + ny * ny + nz * nz <= 1.08) put(x, y, z, material);
      }
    }
  }
  const bridged = bridgeDisconnectedStructure([...structures.values()], bounds);
  return {
    schemaVersion: "3.0", name: String(plan?.name || "Gemini two-pass model"), mode,
    bounds, palette, focalFeatures: Array.isArray(plan?.focalFeatures) ? plan.focalFeatures : [],
    structure: bridged.structure.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2]),
    diagnostics: { partsReceived: parts.length, voxelsBeforeValidation: bridged.structure.length, disconnectedPartsBridged: bridged.bridged },
  };
}

async function generatePartPlan(prompt, mode, size, optimization, referenceImage) {
  // Mode-aware aspect ratio guidance helps Gemini choose bounds that match
  // the subject's natural proportions instead of defaulting to a cube.
  const boundsHint = mode === "character"
    ? (size === "small" ? "Suggested bounds: {x:14, y:20, z:12}." : size === "large" ? "Suggested bounds: {x:22, y:30, z:20}." : "Suggested bounds: {x:18, y:26, z:16}.")
    : mode === "vehicle"
      ? (size === "small" ? "Suggested bounds: {x:18, y:10, z:12}." : size === "large" ? "Suggested bounds: {x:30, y:16, z:18}." : "Suggested bounds: {x:24, y:14, z:16}.")
      : "";
  // Characters need specific anatomical guidance so Gemini creates a
  // proportional full body instead of stacking thin fragments vertically.
  const characterRules = mode === "character" ? [
    "CRITICAL CHARACTER RULES:",
    "- The body/torso part MUST be the largest single part and fill at least 30% of the X and Z axes.",
    "- The head must be proportionally large: 25-40% of total height for cartoon/mascot characters, 15-25% for realistic humanoids.",
    "- You MUST include ALL major body parts as separate overlapping parts: head, torso/body, left arm, right arm, left leg, right leg.",
    "- Arms must extend outward along the X axis from the torso, not be hidden behind or inside it.",
    "- Legs must be placed below the torso and each occupy distinct X positions.",
    "- Ears, tails, hats and other appendages must overlap the part they attach to by at least 1-2 voxels.",
    "- The combined parts must collectively span at least 60% of the X bounds, 80% of the Y bounds, and 50% of the Z bounds.",
    "- Do NOT create a narrow vertical column. Spread the character across its full width and depth.",
  ].join("\n") : "";
  const planInstruction = [
    "Create a compact semantic Minecraft voxel part plan for a local deterministic compiler.",
    "Return only PartPlan v1 JSON. Do not return explicit coordinates, RLE, prose, backgrounds or bases.",
    "Use 5-24 touching parts. The first or largest part MUST be the complete primary body/building/vehicle volume, not a detail.",
    "Use ellipsoid for rounded bodies, cylinder/cone for limbs, beaks, roofs and wheels, wedge for fins/ears, and box only for structural or small detail parts.",
    "The subject is upright on +Y and faces +Z. Front details must be placed on +Z and paired details must be symmetric across X.",
    "Parts must overlap or touch by at least one voxel. Do not create floating decorative parts. Never return only a head, eye, wheel, wing, roof or other single component.",
    "Use the exact requested colours in the palette and assign each feature to the correct part.",
    boundsHint,
    characterRules,
    `Mode: ${mode}. Size: ${size}. Request: ${prompt.slice(0, 1200)}`,
    `Design brief: ${optimization ? JSON.stringify(optimization) : "derive a concise design brief yourself"}`,
  ].filter(Boolean).join("\n");
  const imageMatch = typeof referenceImage === "string" ? referenceImage.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const repairHint = mode === "character"
        ? "\nRepair: the previous candidate was incomplete. Ensure ALL body parts are present (head, torso, both arms, both legs). Parts must be wide enough to fill the bounds — do NOT stack thin slices vertically. Overlap every part with its neighbor by at least 1 voxel."
        : "\nRepair: keep all parts touching and ensure the silhouette contains the requested focal features.";
      const parts = [{ text: attempt ? `${planInstruction}${repairHint}` : planInstruction }];
      if (imageMatch) parts.push({ inlineData: { mimeType: imageMatch[1], data: imageMatch[2] } });
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(voxelModel)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(90_000),
        body: JSON.stringify({ systemInstruction: { parts: [{ text: "You are a semantic Minecraft part planner. Output only valid PartPlan v1 JSON." }] }, contents: [{ role: "user", parts }], generationConfig: { temperature: attempt ? 0.05 : 0.2, maxOutputTokens: 8_000, thinkingConfig: { thinkingLevel: "minimal" }, responseMimeType: "application/json", responseSchema: partPlanSchema } }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || `Gemini part plan failed (${response.status}).`);
      return { plan: extractJson(payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("")), usage: payload.usageMetadata ?? null };
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini part planning failed.");
}

async function optimizePrompt(prompt, mode, size) {
  if (!apiKey || process.env.GEMINI_PROMPT_OPTIMIZER === "false") return null;
  const instruction = [
    "Create a concise voxel design brief for another AI model.",
    "Preserve every explicit color and assign it to the correct feature. Preserve markings and proportions.",
    "Describe one connected silhouette, orientation, palette, and the 3-8 visual features required for recognition.",
    "The coordinate convention is mandatory: upright is +Y, the subject faces +Z, and left/right runs across X.",
    "Small details must be high contrast and physically touch the main body. Do not add a background or display stand.",
    "Constraint: The model MUST be detailed and dense. Do not create minimalist stick figures or sparse outlines. Provide enough detail to use at least a few hundred blocks.",
    `Mode: ${mode}. Size: ${size}. User request: ${prompt.slice(0, 1200)}`,
  ].join("\n");
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(promptModel)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ systemInstruction: { parts: [{ text: "Return only the requested compact JSON brief." }] }, contents: [{ role: "user", parts: [{ text: instruction }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 1200, thinkingConfig: { thinkingLevel: "minimal" }, responseMimeType: "application/json", responseSchema: promptBriefSchema } }),
    });
    const payload = await response.json();
    if (!response.ok) return null;
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
    return { brief: normalizePromptBrief(extractJson(text), prompt, mode), usage: payload.usageMetadata ?? null };
  } catch { return null; }
}

async function generateExplicitVoxelsLegacy(prompt, mode, size, referenceImage) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server.");
  const optimization = await optimizePrompt(prompt, mode, size);
  const targetAxis = size === "small" ? "12-16" : size === "large" ? "18-24" : "14-20";
  const targetBlocks = size === "small" ? "500-1,500" : size === "large" ? "1,800-4,500" : "1,100-3,000";
  const eyeColorMatch = String(prompt || "").toLowerCase().match(/\b(light\s+blue|dark\s+blue|yellow|orange|red|blue|green|lime|purple|magenta|pink|cyan|brown|black|white|gray|grey)\s+eyes?\b/);
  const eyeRule = eyeColorMatch
    ? `The requested ${eyeColorMatch[1]} eyes must be two small separated clusters (1-8 voxels each), one left and one right on the upper +Z face. Never merge the eyes into a visor, mask, beak, stripe or one connected patch.`
    : "Paired eyes, when present, must be two small separated clusters on the upper +Z face.";
  const instruction = [
    "Generate one complete Minecraft-style model as explicit occupied voxels.",
    "Return only ExplicitVoxelSpec v3 JSON. Do not return primitives, boxes, spheres, operations, RLE, code, prose, a background, a base plate, or empty voxels.",
    "Every structure entry must be exactly [x,y,z,materialIndex]. Sort entries by y, then x, then z so the model can build bottom-up.",
    "MANDATORY ORIENTATION: Y is up, the face/front points toward increasing Z, and X is left/right. Put eyes, beaks, grilles, doors and other front details on the +Z outer surface.",
    "All coordinates must be inside bounds. All material indices must reference palette. Use real minecraft block ids.",
    "The model must be one connected 6-neighbor voxel body. Eyes, markings, wings, tails, wheels and panels must touch the body; never place detached decorative cubes.",
    "Honor explicit colors exactly and assign them to the requested features. Use contrasting voxels for eyes, windows, beaks, stripes and insignia.",
    `Target dimensions per axis: ${targetAxis}. Target occupied blocks: ${targetBlocks}. Absolute maximum: ${MAX_BLOCKS}.`,
    "Use solid or deliberately hollow voxel volumes with a recognizable silhouette from front, side and isometric views.",
    "Organic subjects must use stepped curved contours, not stacked rectangular boxes: vary width and depth repeatedly from layer to layer, separate head from torso/body, and make appendages change the outer silhouette.",
    "Surface markings replace body surface voxels and conform to the surface. They must never float outside it. Paired features must be symmetrical across X and visible together from +Z.",
    eyeRule,
    `Original request: ${prompt.slice(0, 1200)}`,
    `Structured brief: ${optimization ? JSON.stringify(optimization) : "Use the original request directly."}`,
  ].join("\n");
  const imageMatch = typeof referenceImage === "string" ? referenceImage.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
  const parts = [{ text: instruction }];
  if (imageMatch) parts.push({ inlineData: { mimeType: imageMatch[1], data: imageMatch[2] } });
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(voxelModel)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(120_000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "You are an explicit voxel modeller. Output every occupied block and no geometric primitives." }] },
          contents: [{ role: "user", parts: attempt ? [{ text: `${instruction}\nRetry requirement: the previous candidate failed validation. Produce a fully solid, connected model near the requested block target and complete the entire JSON array.` }, ...parts.slice(1)] : parts }],
          generationConfig: { temperature: attempt ? 0.05 : 0.15, maxOutputTokens: size === "large" ? 40_000 : size === "small" ? 22_000 : 32_000, thinkingConfig: { thinkingLevel: "minimal" }, responseMimeType: "application/json", responseSchema: explicitVoxelSchema },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || `Gemini voxel request failed (${response.status}).`);
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
      let parsed;
      try { parsed = extractJson(text); }
      catch (error) {
        const finishReason = payload.candidates?.[0]?.finishReason || "unknown";
        const preview = String(text || "").slice(0, 220).replace(/\s+/g, " ");
        throw new Error(`Explicit voxel JSON was invalid (finish=${finishReason}, chars=${String(text || "").length}): ${preview}`);
      }
      const normalized = normalizeExplicitSpec(parsed, prompt, mode, size);
      return { ...normalized, optimization, attempts: attempt + 1 };
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("Explicit voxel generation failed.");
}

// ---------------------------------------------------------------------------
// Single-pass direct-voxel generator for characters and objects.
// Geometric primitives (ellipsoid, box, cylinder) are too coarse to capture
// recognizable character features. This function lets Gemini place every
// voxel directly, producing much more detailed and proportional results.
// ---------------------------------------------------------------------------
async function generateCharacterVoxels(prompt, mode, size, referenceImage, targetModel = voxelModel) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server.");
  const optimizationResult = await optimizePrompt(prompt, mode, size);
  const optimization = optimizationResult?.brief ?? null;
  const usage = { prompt: optimizationResult?.usage ?? null, direct: null, total: 0 };

  // Mode-aware bounds and targets
  const boundsGuide = mode === "character"
    ? (size === "small" ? "bounds {x:14, y:20, z:12}" : size === "large" ? "bounds {x:22, y:30, z:20}" : "bounds {x:18, y:26, z:16}")
    : (size === "small" ? "bounds {x:14, y:14, z:14}" : size === "large" ? "bounds {x:24, y:24, z:24}" : "bounds {x:18, y:18, z:18}");
  const targetBlocks = size === "small" ? "400-1,200" : size === "large" ? "1,800-4,500" : "1,000-3,000";
  const targetAxis = size === "small" ? "12-16" : size === "large" ? "18-26" : "14-22";

  const eyeColorMatch = String(prompt || "").toLowerCase().match(/\b(light\s+blue|dark\s+blue|yellow|orange|red|blue|green|lime|purple|magenta|pink|cyan|brown|black|white|gray|grey)\s+eyes?\b/);
  const eyeRule = eyeColorMatch
    ? `The requested ${eyeColorMatch[1]} eyes must be two small separated clusters (1-8 voxels each), one left and one right on the upper +Z face.`
    : "Paired eyes, when present, must be two small separated clusters on the upper +Z face.";

  const characterAnatomy = mode === "character" ? [
    "",
    "CHARACTER ANATOMY — CRITICAL:",
    "Build the character layer by layer from feet (y=0) upward. Think of each Y-layer as a horizontal cross-section slice.",
    "The character MUST have a complete, recognizable body with ALL of these parts:",
    "  • Feet/shoes: y=0 to y≈3. Two separate clusters, each 3-5 voxels wide.",
    "  • Legs: y≈2 to y≈8. Two columns, each 2-4 voxels wide, separated by 1-2 voxels.",
    "  • Torso/body: y≈6 to y≈14. The widest part of the character, spanning 50-70% of X bounds.",
    "  • Arms: extend from the torso sides. Each arm 2-3 voxels wide, extending outward along X.",
    "  • Head: top 25-40% of total height for cartoon/mascot characters. Round cross-sections.",
    "  • Character-specific features (ears, hats, tails, etc.) must be present and recognizable.",
    "",
    "PROPORTIONS: The character must fill at least 60% of X-width, 80% of Y-height, and 40% of Z-depth.",
    "Do NOT create a narrow column. Each body part must have realistic WIDTH and DEPTH, not just height.",
    "At the widest point, the cross-section should span at least 8 voxels across X.",
  ].join("\n") : "";

  const instruction = [
    "Generate one complete Minecraft-style model as explicit occupied voxels.",
    "Return only ExplicitVoxelSpec v3 JSON. Do not return primitives, boxes, spheres, operations, RLE, code, prose, a background, a base plate, or empty voxels.",
    "Every structure entry must be exactly [x,y,z,materialIndex]. Sort entries by y, then x, then z so the model can build bottom-up.",
    `Use ${boundsGuide}. Target dimensions per axis: ${targetAxis}. Target occupied blocks: ${targetBlocks}. HARD MINIMUM: at least ${size === "large" ? 400 : size === "small" ? 50 : 150} voxels or the model will be rejected. Absolute maximum: ${MAX_BLOCKS}.`,
    "MANDATORY ORIENTATION: Y is up, the face/front points toward increasing Z, and X is left/right. Center the model in the X and Z axes.",
    "All coordinates must be inside bounds. All material indices must reference palette. Use real minecraft block ids.",
    "The model must be one connected 6-neighbor voxel body. Every part must physically touch the main body.",
    "Honor explicit colors exactly. Use contrasting voxels for eyes, markings, and details.",
    "Use stepped curved contours for organic shapes — vary width and depth from layer to layer.",
    "Surface markings replace body surface voxels. Paired features must be symmetrical across X.",
    eyeRule,
    characterAnatomy,
    `Original request: ${prompt.slice(0, 1200)}`,
    `Structured brief: ${optimization ? JSON.stringify(optimization) : "Use the original request directly."}`,
  ].filter(Boolean).join("\n");

  const imageMatch = typeof referenceImage === "string" ? referenceImage.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
  const maxTokens = size === "large" ? 65_000 : size === "small" ? 30_000 : 45_000;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parts = [{ text: attempt
        ? `${instruction}\n\nRETRY: The previous attempt was incomplete or too sparse. You MUST output ALL body parts with correct proportions. Every Y-layer cross-section must have realistic width. Fill the full target block count.`
        : instruction }];
      if (imageMatch) parts.push({ inlineData: { mimeType: imageMatch[1], data: imageMatch[2] } });
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(180_000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "You are an expert voxel sculptor. Output every occupied block coordinate directly. Think layer by layer from the ground up to create a proportional, recognizable model." }] },
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: attempt ? 0.08 : 0.18, maxOutputTokens: maxTokens, thinkingConfig: { thinkingLevel: "minimal" }, responseMimeType: "application/json", responseSchema: explicitVoxelSchema },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || `Gemini character voxel request failed (${response.status}).`);
      usage.direct = payload.usageMetadata ?? null;
      usage.total = [usage.prompt, usage.direct].filter(Boolean).reduce((sum, item) => sum + Number(item.totalTokenCount || 0), 0);
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
      let parsed;
      try { parsed = extractJson(text); }
      catch (parseError) {
        const finishReason = payload.candidates?.[0]?.finishReason || "unknown";
        throw new Error(`Character voxel JSON was invalid (finish=${finishReason}, chars=${String(text || "").length}).`);
      }
      const normalized = normalizeExplicitSpec(parsed, prompt, mode, size);
      return { ...normalized, optimization, usage, attempts: attempt + 1, pipeline: "direct-voxel-character" };
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("Character voxel generation failed.");
}

async function generateTwoPassModel(prompt, mode, size, referenceImage, targetModel, forceDirectDraw) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server.");

  // Characters and objects benefit from direct voxel output — geometric
  // primitives are too coarse to capture recognizable features like faces,
  // ears, hands and character-specific details.
  if (forceDirectDraw || mode === "character" || mode === "object") {
    return generateCharacterVoxels(prompt, mode, size, referenceImage, targetModel);
  }

  const optimizationResult = await optimizePrompt(prompt, mode, size);
  const optimization = optimizationResult?.brief ?? null;
  const usage = { prompt: optimizationResult?.usage ?? null, parts: null, total: 0 };
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const planResult = await generatePartPlan(prompt, mode, size, optimization, referenceImage);
      const plan = planResult.plan;
      usage.parts = planResult.usage;
      usage.total = [usage.prompt, usage.parts].filter(Boolean).reduce((sum, item) => sum + Number(item.totalTokenCount || 0), 0);
      const explicit = compilePartPlan(plan, mode, prompt, size);
      const normalized = normalizeExplicitSpec(explicit, prompt, mode, size);
      return { ...normalized, optimization, usage, attempts: attempt + 1, scenePlan: { schemaVersion: "1.0", name: plan.name, mode: plan.mode, partCount: Array.isArray(plan.parts) ? plan.parts.length : 0 }, compileDiagnostics: explicit.diagnostics };
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini two-pass generation failed.");
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host || "localhost"}`);
    if (request.method === "OPTIONS") return json(response, 204, {});
    if (request.method === "GET" && url.pathname === "/api/health") return json(response, 200, { ok: true, provider: "gemini", pipeline: "gemini-two-pass-scene-compiler-v1", promptModel, voxelModel, configured: Boolean(apiKey), maxBlocks: MAX_BLOCKS });
    if (request.method === "POST" && url.pathname === "/api/generate") {
      const body = JSON.parse(await readBody(request));
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      const size = ["small", "medium", "large"].includes(body.size) ? body.size : "medium";
      const mode = modes.includes(body.mode) ? body.mode : detectMode(prompt);
      const requestedModel = allowedModels.includes(body.model) ? body.model : voxelModel;
      const referenceImage = typeof body.referenceImage === "string" ? body.referenceImage : undefined;
      const forceDirectDraw = Boolean(body.forceDirectDraw);
      if (prompt.length < 4) return json(response, 400, { error: "Please describe a model first." });
      const generated = await generateTwoPassModel(prompt, mode, size, referenceImage, requestedModel, forceDirectDraw);
      return json(response, 200, { provider: "gemini", pipeline: generated.pipeline || "gemini-two-pass-scene-compiler-v1", stages: ["designing_blueprint", "sculpting_voxels", "validating", "assembling_export"], promptModel, model: requestedModel, mode, spec: generated.spec, optimization: generated.optimization, usage: generated.usage, scenePlan: generated.scenePlan, qualityReport: { ...generated.qualityReport, promptOptimized: Boolean(generated.optimization), attempts: generated.attempts } });
    }
    return json(response, 404, { error: "Not found." });
  } catch (error) {
    return json(response, 500, { error: error instanceof Error ? error.message : "Server error." });
  }
});

server.listen(port, host, () => console.log(`BlockDraft ExplicitVoxel v3 API listening on http://${host}:${port} (${voxelModel})`));
