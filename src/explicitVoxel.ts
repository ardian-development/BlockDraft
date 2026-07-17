import type { BlockPlacement, CompiledStructure } from "./types";

export type GenerationMode = "architecture" | "object" | "character" | "vehicle" | "pixel_art";
export type ExplicitVoxel = [x: number, y: number, z: number, materialIndex: number];

export interface ExplicitVoxelSpec {
  schemaVersion: "3.0";
  name: string;
  mode: GenerationMode;
  bounds: { x: number; y: number; z: number };
  palette: string[];
  focalFeatures: string[];
  structure: ExplicitVoxel[];
}

const MAX_BLOCKS = 5_000;

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function safeBlockId(value: unknown): string {
  const block = String(value || "").trim().toLowerCase();
  return /^minecraft:[a-z0-9_./-]+$/.test(block) ? block : "minecraft:stone";
}

export function compileExplicitVoxelSpec(spec: ExplicitVoxelSpec): CompiledStructure {
  const dimensions = {
    x: clampInt(spec.bounds?.x, 16, 1, 32),
    y: clampInt(spec.bounds?.y, 16, 1, 32),
    z: clampInt(spec.bounds?.z, 16, 1, 32),
  };
  const palette = Array.isArray(spec.palette) && spec.palette.length
    ? spec.palette.slice(0, 12).map(safeBlockId)
    : ["minecraft:stone"];
  const map = new Map<string, BlockPlacement>();
  let rejected = 0;

  for (const entry of spec.structure ?? []) {
    if (!Array.isArray(entry) || entry.length < 4) { rejected++; continue; }
    const x = Number(entry[0]), y = Number(entry[1]), z = Number(entry[2]), materialIndex = Number(entry[3]);
    if (![x, y, z, materialIndex].every(Number.isInteger) || x < 0 || y < 0 || z < 0 || x >= dimensions.x || y >= dimensions.y || z >= dimensions.z || materialIndex < 0 || materialIndex >= palette.length) {
      rejected++;
      continue;
    }
    const blockId = palette[materialIndex];
    map.set(`${x},${y},${z}`, { x, y, z, material: `voxel-${materialIndex}`, blockId, sourceOperationId: "explicit-voxel" });
  }

  const blocks = [...map.values()].sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z);
  if (blocks.length > MAX_BLOCKS) throw new Error(`The explicit voxel model exceeds the ${MAX_BLOCKS.toLocaleString("en-US")}-block quality budget.`);
  const warnings: string[] = [];
  if (rejected) warnings.push(`${rejected} invalid voxel entries were rejected before preview.`);
  if (!blocks.length) warnings.push("The generator returned an empty voxel model.");
  if (blocks.length < 100) warnings.push("This model is unusually sparse and may lack recognizable detail.");
  if (blocks.length > 4_000) warnings.push("Dense model: preview and Minecraft import may take longer.");
  const histogram: Record<string, number> = {};
  for (const block of blocks) histogram[block.blockId] = (histogram[block.blockId] ?? 0) + 1;
  return { blocks, dimensions, histogram, warnings };
}

export function toMcfunction(structure: CompiledStructure): string {
  const lines = [
    "# BlockDraft ExplicitVoxelSpec v3",
    `# Blocks: ${structure.blocks.length}`,
    "# Origin: execution position; coordinates are relative",
    ...structure.blocks.map((block) => `setblock ~${block.x} ~${block.y} ~${block.z} ${block.blockId}`),
  ];
  return `${lines.join("\n")}\n`;
}

export function fakeExplicitPlan(): ExplicitVoxelSpec {
  const structure: ExplicitVoxel[] = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) for (let z = 0; z < 10; z++) {
    const shell = y === 0 || y === 7 || x === 0 || x === 11 || z === 0 || z === 9;
    if (shell) structure.push([x, y, z, y >= 6 ? 1 : 0]);
  }
  return { schemaVersion: "3.0", name: "Local explicit voxel sample", mode: "architecture", bounds: { x: 12, y: 8, z: 10 }, palette: ["minecraft:stone_bricks", "minecraft:deepslate_tiles"], focalFeatures: ["bounded shell"], structure };
}
