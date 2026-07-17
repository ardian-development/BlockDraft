# BlockDraft output quality improvement plan

## Diagnosis: why “rubber duck with pirate hat” fails today

### Implemented first slice (2026-07-14)

The local MVP now has a deterministic `sphere` primitive, palette-aware preview colors and a first object template for `soccer ball`/`football`. Those prompts bypass the generic architecture planner so the result is a recognizable white sphere with black surface details instead of a hollow cylinder with lantern-colored patches. This is a targeted quality fix, not a substitute for the full character/prop pipeline below.

The current result quality is limited by the representation and compiler, not only by the AI model.

1. The Gemini server prompt says to create a **small geometric Minecraft structure** and explicitly says not to create characters. A rubber duck is therefore routed into the wrong problem class.
2. The current BuildSpec now supports a basic `sphere`, but it still has no ellipsoid, cone, wedge, mirror, attach or semantic part primitive.
3. The current palette has only six material roles and no explicit object/feature palette. A duck needs at least yellow body, orange beak, black/brown hat, red band, white/black eyes and possibly a feather.
4. The model is asked to reason directly in low-level block operations. It has no intermediate understanding that the prompt contains a subject (`duck`), an accessory (`pirate hat`) and focal features (`beak`, `eyes`, `hat band`).
5. There is no rendered-image evaluator. The pipeline accepts syntactically valid JSON even when the output does not visibly match the prompt.
6. The current limits are shared by architecture and objects. A 32³/5,000-block architecture budget is not automatically the right budget for a recognizable character.

**Conclusion:** increasing the block limit alone will not fix this. We need routing, semantic decomposition, a richer deterministic compiler and a visual quality check.

## Target quality architecture

```text
User prompt/photo
  -> intent router
  -> normalized SceneSpec (subject, parts, attributes, focal features)
  -> template/retrieval layer
  -> deterministic voxel compiler
  -> 3D preview from 3-4 cameras
  -> visual evaluator
  -> targeted repair (maximum one or two passes)
  -> BuildSpec + export
```

The AI should plan the object semantically. The compiler should decide exactly which blocks to place. This is more reproducible, cheaper to repair and easier to test than asking an LLM to write thousands of block coordinates directly.

## Phase 1: introduce intent modes

Add a required mode to the generation request:

- `architecture`: houses, towers, bridges, temples and rooms
- `character`: animals, mascots and stylized creatures
- `prop`: objects such as a sword, chest, vehicle or lamp
- `pixel_art`: logos, lettering and front-facing raster designs
- `modular_pack`: larger scenes split into connected modules

Route automatically from keywords, but always show the detected mode before generation. A prompt containing `duck`, `animal`, `character`, `wearing`, `hat`, `face`, `mascot` or `pet` should not use the architecture prompt.

Example UI copy:

> Detected: Character / Prop
> Focus features: yellow rubber duck, orange beak, pirate hat, red hat band

The user can override the mode manually.

## Phase 2: add a semantic SceneSpec

Do not send the model directly to the existing low-level BuildSpec. Add an intermediate schema:

```json
{
  "intent": "character",
  "subject": "rubber duck",
  "style": "friendly low-poly voxel toy",
  "view": "front_three_quarter",
  "parts": [
    { "id": "body", "role": "main_body", "primitive": "ellipsoid", "size": [24, 20, 20], "material": "yellow" },
    { "id": "beak", "role": "focal_feature", "primitive": "wedge", "anchor": "front_center", "material": "orange" },
    { "id": "hat", "role": "accessory", "primitive": "dome", "anchor": "top", "material": "black" },
    { "id": "hat_band", "role": "accessory_detail", "primitive": "ring", "anchor": "hat_lower", "material": "red" },
    { "id": "eyes", "role": "focal_feature", "primitive": "pair", "anchor": "face", "material": "black" }
  ],
  "constraints": { "bounds": [32, 32, 32], "maxBlocks": 8000 }
}
```

The SceneSpec is where the model describes meaning. A deterministic compiler then resolves anchors, symmetry, proportions, materials and block states.

## Phase 3: expand the voxel compiler

Add safe, testable primitives in this order:

1. `sphere` and `ellipsoid` for bodies, heads and rounded props.
2. `cone`, `frustum` and `wedge` for beaks, roofs, noses and hats.
3. `ring`, `band` and `disc` for hat bands, eyes and trim.
4. `mirror_x`, `mirror_z` and `pair` for eyes, wings and symmetric details.
5. `attach` with named anchors (`top`, `front`, `face`, `left`, `right`, `rear`).
6. `union` and `subtract` for clean silhouettes and holes.
7. `voxel_stamp` for small curated pixel-art details.

Every primitive must be deterministic, bounded and unit-tested. The compiler, not Gemini, calculates the actual block coordinates.

## Phase 4: create a small template library

Templates will outperform a blank LLM for recurring recognizable forms. Start with parameterized templates:

- rubber duck: body, head, beak, eyes, wings, tail
- pirate hat: crown, brim, band, feather/skull flag as optional details
- cat, dog, bird and simple humanoid mascot
- sword, chest, shield, lantern and vehicle prop

The model selects and parameterizes templates; it does not need to reinvent their topology. Templates should be original BlockDraft geometry and stored with a version, license and test fixtures.

For unusual objects, fall back to generic primitives and show a lower confidence score.

## Phase 5: two-pass planning and visual repair

### Pass A: semantic plan

Gemini returns the SceneSpec with subject, attributes, parts, palette, focal features and confidence. The server validates it before compiling.

### Pass B: deterministic compile

The compiler produces BuildSpec, blocks, bounds, histogram and a renderable preview.

### Pass C: visual evaluator

Render low-resolution orthographic images from front, side and three-quarter cameras. Send the rendered images plus the original normalized prompt to a vision-capable evaluator. Score:

- subject recognizability
- focal feature presence
- accessory presence
- silhouette coherence
- palette match
- bounds/block budget compliance

If a score is low, issue one targeted repair such as “move the hat down two blocks and enlarge the orange beak,” not a complete regeneration. If the repair still fails, show the confidence warning instead of pretending the result is correct.

## Phase 6: mode-specific limits

Limits should be explicit and mode-specific:

| Mode | Recommended bounds | Hard block limit | Operation limit |
|---|---:|---:|---:|
| Architecture | 8–24 per axis | 12,000 | 200 |
| Character | 24–40 per axis | 8,000 initially | 300 |
| Prop | 16–32 per axis | 6,000 | 240 |
| Pixel art | 32–64 per axis | 10,000 | 400 |
| Modular pack | 24–32 per module | 5,000 per module | 200 per module |

Character mode should start at 32³ and 8,000 blocks. Increase only after benchmark results show that larger bounds improve recognition rather than create noisy detail.

## Prompt normalization

Before generation, convert a free-form prompt into a compact creator brief:

```text
Subject: rubber duck
Accessory: pirate tricorn hat
Focal features: orange beak, visible eyes, red hat band
Style: friendly low-poly voxel toy
View: front three-quarter
Palette: yellow, orange, black, red, white
Scale: medium character, centered, isolated
```

This brief is shown to the user and passed to Gemini. It makes ambiguity visible and gives the evaluator a stable target.

## UX changes

Add these controls to the Create composer:

- Mode: `Architecture`, `Character`, `Prop`, `Pixel Art`
- Style: `Low-poly`, `Blocky`, `Detailed`, `Minimal`
- Focal features: editable chips
- Palette: selectable material chips
- Camera: `Front`, `Three-quarter`, `Isometric`
- `Improve match` button after a result
- Confidence badge: `High`, `Medium`, `Needs review`

Show a warning when the prompt requests a protected character, exact logo or tiny lettering. Do not silently route it to a poor generic result.

## Benchmark before changing models

Create a fixed fixture set of at least 50 prompts:

- 15 architecture prompts
- 15 character/animal prompts
- 10 prop prompts
- 5 photo references
- 5 deliberately unsupported prompts

For each fixture record:

- mode detection accuracy
- schema/compile success
- block count and bounds
- focal-feature presence
- evaluator score
- human acceptance (pass/fail)
- cost and latency

The first target is not “looks perfect.” It is **80% of supported prompts visibly containing the requested subject and all declared focal features**. Unsupported prompts should be honestly rejected or downgraded.

## Recommended implementation order

### Milestone A — immediate

- Remove the global “no characters” restriction from the prompt and make it architecture-mode-specific.
- Add intent routing and normalized creator brief.
- Add `character` and `prop` mode to the UI.
- Add output confidence and focal-feature metadata.

### Milestone B — quality foundation

- Implement sphere/ellipsoid, wedge, cone, ring and mirror primitives.
- Add the duck and pirate-hat templates.
- Compile SceneSpec to the existing BuildSpec/exporter.
- Add 20 character/prop benchmark fixtures.

### Milestone C — feedback loop

- Add multi-camera preview renders.
- Add Gemini visual evaluation.
- Add one targeted repair pass and `Improve match`.
- Track accepted output, cost and repair rate.

### Milestone D — scale and community

- Expand the template library based on real prompts.
- Let creators save and remix successful templates.
- Add a curated gallery filter by mode and confidence.

## Final architectural decision

Do not solve poor object output by simply increasing the universal block limit or switching models. The correct solution is a separate character/prop representation with semantic parts, deterministic shape primitives, templates and a visual repair loop. Architecture mode can keep conservative limits; recognizable objects get a larger but still bounded budget and a pipeline designed for focal features.
