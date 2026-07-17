# AI, compiler, 3D preview and export

## 1. BuildSpec strategy

The AI designs with a small vocabulary of geometric operations instead of emitting thousands of blocks. This reduces tokens and gives deterministic validation.

MVP operations:

- `box`: filled cuboid.
- `hollow_box`: shell with configurable floor/ceiling.
- `wall`: axis-aligned wall between two points.
- `line`: integer 3D Bresenham line for beams/cables.
- `cylinder`: vertical filled or hollow cylinder.
- `dome`: upper ellipsoid shell.
- `gable_roof`: two roof planes over an axis-aligned footprint.
- `stairs`: straight staircase with width and direction.
- `place`: one block, used only for limited details.
- `carve_box`: removes voxels for doors/windows/interiors.

No arbitrary recursion in MVP. Repetition is represented as bounded `repeat` with a nested primitive, max 32 instances. Mirror and rotate are structure-level transforms applied by the compiler.

Coordinate system: right-handed integers, X east/west, Y up, Z north/south. BuildSpec origin is minimum corner `(0,0,0)`. Negative coordinates are invalid before a structure transform. All dimensions are inclusive/exclusive as documented in the schema: `min` inclusive, `size` positive.

## 2. Prompt pipeline

System instruction must include product limits, coordinate convention, allowed operations, palette keys, structural rules and the supplied JSON schema. It must demand architecture rather than pixel art and must not include secrets or internal moderation rules.

Pipeline:

1. Normalize language and remove control characters; retain the original for the user.
2. Classify allowed/unsupported/unsafe and derive requested category.
3. Create PlannerInput with explicit bounds, palette and style.
4. Call structured-output model with temperature near deterministic.
5. Parse JSON; validate schema and semantic rules.
6. If invalid, send only validation errors and invalid JSON to one repair call.
7. Compile and run structural quality checks.
8. Save success or refund quota.

Semantic checks include non-empty result, entrance/opening for building categories, supported materials, no disconnected detail more than configured distance, bounds, counts and minimum floor contact. Quality warnings do not fail a build unless safety or limits are violated.

Provider evaluation set: at least 100 prompts across houses, towers, bridges, temples, rooms, roofs, symmetry, material adherence and adversarial inputs. Score schema validity, compile success, visual rubric, latency and cost. Change production model only behind a versioned experiment.

## 2a. Photo-to-build pipeline

Photo mode is an optional vision input, not an image-to-voxel promise. The robust workflow is:

```text
file picker -> client resize/metadata strip -> signed temporary upload
  -> vision model describes visible architecture and confidence
  -> planner converts description + user constraints to BuildSpec
  -> validator/compiler -> preview -> user confirmation -> export
```

`reference` mode uses the image for style, roof/window/material cues while respecting an explicit size. `reconstruct` mode attempts a front-facing approximation and must show warnings for occluded sides, perspective, scale and inferred dimensions. A two- or three-view upload can be supported later, but MVP accepts one image only.

Image storage defaults: WebP/JPEG, max 1600px longest edge, max 8 MB before resizing, temporary object path, automatic deletion after 24 hours, no EXIF retention. The provider adapter receives a signed/short-lived input and returns only a structured visual description or BuildSpec; it never gets database or file-system tools.

This mode is more expensive than text-only generation because it sends image tokens and often requires a repair call. Track it as a separate quota/cost class and keep a hard per-user daily limit.

## 3. Compiler rules

- Use an integer-key map such as `x,y,z -> BlockPlacement` while expanding.
- Reject any primitive before expansion if its theoretical bound exceeds limits.
- Track operation id on placements for diagnostics.
- Apply operations in array order.
- Carves delete keys; other operations overwrite keys.
- Normalize block state property ordering.
- Recompute tight bounds after all operations and shift to origin.
- Emit canonical array and histogram.
- Verify total block count after expansion.

Required fixture tests: one fixture per primitive, rotations, mirrors, overlaps, carving, exact boundary, overflow, determinism and malicious extreme numbers. Snapshot tests assert canonical hashes.

## 4. 3D implementation

Three.js `InstancedMesh` reduces draw calls when many cubes share geometry/material. Group placements by preview material and geometry type. Create one `BoxGeometry` shared across all opaque cube groups and one instance matrix per block. Do not render a React element per placement.

Scene:

- WebGL2 renderer, sRGB output.
- Perspective camera and orbit controls.
- Ambient/hemisphere plus one directional light; shadows disabled by default.
- Neutral ground plane, grid helper and bounding box.
- Material atlas or per-material simple textures; nearest-neighbor filtering.
- Transparent materials rendered in separate groups after opaque materials.
- Dispose geometries, materials and textures when a structure changes.

Data flow:

```text
compiled payload -> Web Worker decode/group -> typed arrays -> InstancedMesh groups
```

MVP may group on the main thread for <=5,000 blocks, but keep grouping as a pure function ready for a Web Worker. Camera auto-fits the bounding sphere. Raycasting maps `instanceId` back to block coordinates through a group index array.

Performance acceptance:

- <=12 draw calls for a typical four-material structure plus helpers.
- Stable 30 FPS while orbiting 5,000 blocks on reference hardware.
- No retained GPU resources after switching structures 20 times.
- WebGL failure shows stats, a server-generated image if present and export access.

Future optimization above 20,000 blocks: chunking and greedy meshing. Do not build it in MVP.

## 5. Java mcfunction exporter

Input is the canonical compiled block array plus registry/game version. Validate again. Translate coordinates to `~x ~y ~z`; use `~` for zero. Safe baseline:

```mcfunction
setblock ~0 ~0 ~0 minecraft:stone
```

Before release, integration tests must confirm exact command syntax in the selected Minecraft version. Optimize only blocks that form provably uniform rectangular cuboids into `fill` commands and respect the game command-volume limit. Never optimize transparent/special stateful blocks without adapter tests.

For large command sets, split into numbered functions and create a small entry function if the selected datapack/version supports the chosen layout. Export adapters expose:

```ts
interface StructureExporter {
  id: string;
  gameEdition: "java" | "bedrock";
  gameVersion: string;
  export(input: CanonicalStructure): Promise<ExportArtifact[]>;
}
```

Post-MVP adapters: `.schem`, Litematica `.litematic`, Java structure NBT and Bedrock. Each requires its own compatibility fixtures; never rename one format as another.
