# Explicit Voxel v3 rebuild

Status: implemented as a guarded benchmark path; rejected as the final universal-quality architecture  
Date: 2026-07-14

## Decision

BlockDraft no longer compiles AI-authored primitives, templates, spheres, boxes or prompt-specific algorithms. Every generation uses one representation for architecture, objects, animals, characters and vehicles: an explicit list of occupied voxel coordinates and their palette index.

This mirrors the useful architectural property visible in exported Minecraft structure JSON without copying a competitor's code, prompts, branding or interface.

## Canonical contract

```json
{
  "schemaVersion": "3.0",
  "name": "Red rubber duck",
  "mode": "character",
  "bounds": { "x": 24, "y": 20, "z": 24 },
  "palette": [
    "minecraft:red_concrete",
    "minecraft:yellow_concrete",
    "minecraft:orange_concrete"
  ],
  "focalFeatures": ["paired yellow eyes", "orange beak"],
  "structure": [[0, 0, 4, 0], [1, 0, 3, 0]]
}
```

Each structure tuple is `[x, y, z, materialIndex]`. Coordinates are integers inside the declared bounds. The final canonical list is deduplicated and sorted by `y`, then `x`, then `z`.

## Generation pipeline

```text
user prompt / optional reference image
  -> cheap structured prompt optimizer
  -> unified explicit-voxel model
  -> strict JSON parsing and normalization
  -> coordinate, material and budget validation
  -> largest 6-neighbour component validation
  -> requested-colour and focal-feature checks
  -> one complete regeneration attempt on failure
  -> canonical block list
  -> bottom-up preview and .mcfunction export
```

The optimizer expands short input into subject, silhouette, orientation, exact palette, focal features and build constraints. It does not create geometry. The voxel model creates all geometry in a single coherent coordinate system.

## Hard limits

- Maximum bounds: `32 x 32 x 32`.
- Maximum occupied blocks: `5,000`.
- No negative or fractional coordinates.
- No unknown palette indexes or unsafe Minecraft block IDs.
- No backgrounds, bases, invisible voxels, operations, RLE or geometric primitives.
- The visible subject must form one six-neighbour-connected main body. Detached fragments are removed and reported.
- Requested colours must be present in the final used palette.
- Focal features are validated where a reliable invariant exists, such as paired eye voxels for an explicit eye colour.

The block limit is an output contract, not a prompt instruction such as “make exactly 5,000 blocks”. Conservative size-specific minimums only reject clearly truncated output. Block count is not treated as a proxy for visual quality; a compact recognizable model is preferable to padded geometry.

## Preview lifecycle

The viewer receives only the canonical explicit list. Blocks are grouped by material while preserving vertical order. Instance counts reveal successive Y layers over roughly 0.7 to 2.2 seconds, producing a bottom-up build animation.

Every accepted generation recreates the scene, camera fit and animation state. On cleanup, geometries, materials, renderer and WebGL context are disposed so a second generation does not inherit broken GPU state from the first.

## Quality acceptance

Automated acceptance covers:

1. Valid schema and bounded coordinates.
2. Unique occupied coordinates.
3. Safe, used-only palette.
4. One connected visible body after normalization.
5. Requested colours represented by visible blocks.
6. Size-appropriate minimum and global maximum block counts.
7. Prompt-specific invariants only when they generalize, never handcrafted subject geometry.

Smoke prompts included a coloured rubber duck, a black-and-white soccer ball and a medieval watchtower. The final rubber-duck acceptance run correctly rejected a generated connected yellow face patch because it was not two separated eye clusters. This proves that validation can stop visibly wrong output, but also proves that one-shot text-to-coordinate generation is not reliable enough to claim production-grade quality for arbitrary prompts.

The successor architecture must synthesize or obtain a visual reference and reconstruct voxels from visual evidence instead of asking a language model to invent every coordinate. See [Visual Reconstruction v4](19-visual-reconstruction-v4.md).

## Cost and product implications

The normal path makes two text/structured-output calls and at most one repair generation. It avoids paid image-to-3D mesh APIs. Costs still require measured token telemetry, quotas and paid-plan unit economics; “unlimited” must be guarded by fair-use and abuse controls.
