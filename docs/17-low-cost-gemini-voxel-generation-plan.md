# Low-cost Gemini voxel generation plan (superseded)

> Superseded on 2026-07-14 by [Explicit Voxel v3 rebuild](18-explicit-voxel-v3-rebuild.md). The hybrid primitive/RLE design described below is retained only as decision history and is not part of the active application.

Status: baseline implemented locally (Gemini-first VoxelSpec v2 + deterministic compiler, optional user reference image); benchmark/evaluator loop remains the next quality milestone.  
Date: 2026-07-14  
Product: BlockDraft  
Decision owner: project owner

## 1. Decision

BlockDraft will test a Gemini-first generation pipeline for the standard product. Hunyuan/Meshy/Tripo-style 3D mesh APIs are removed from the default generation path and remain optional premium experiments only.

The standard pipeline must generate recognizable architecture, props, characters, animals and vehicles without requiring a handcrafted asset for every subject. It will combine:

- cheap semantic planning;
- a compact voxel representation;
- deterministic local compilation;
- multi-view rendering;
- bounded visual evaluation and patching.

No automatic web or image search is part of the default pipeline. For uncommon or visually precise subjects, the user can upload a reference image. This is cheaper, more predictable and avoids silently scraping third-party images.

The local implementation now adds an optional low-cost prompt-brief pass before object generation. It extracts the subject, silhouette, palette, orientation, camera and focal features with the fast Gemini model; the stronger voxel model receives both the original request and this structured brief. If the brief call fails, generation continues with the original prompt.

The deterministic compiler also applies a soccer-ball boundary check: dark panel voxels outside the normalized spherical body are removed before preview/export. This is intentionally enforced after model generation because prompt instructions alone cannot guarantee containment.

The compiler receives the original prompt as validation context, so subject-specific checks still run even when Gemini returns a generic model name. The Three.js viewer explicitly releases its WebGL context during regeneration to keep repeated previews stable without a page reload.

## 2. What is proven and what is still a hypothesis

### Proven

- Gemini can return structured JSON.
- The current BlockDraft compiler can deterministically turn a validated plan into blocks.
- The browser can render thousands of blocks efficiently with instancing.
- A compact operation plan costs far less than a generated 3D mesh.
- The current poor object quality is caused primarily by the architecture-only schema, prompt and primitive limits.

### Hypotheses to test

- Gemini 3 Flash can produce recognizable 32–48 voxel objects directly.
- Layer run-length encoding is easier and cheaper for the model than explicit `[x,y,z,material]` coordinates.
- A hybrid of semantic primitives plus RLE detail patches gives the best quality/cost balance.
- A rendered-image evaluator can identify missing focal features and return a small correction rather than requiring a full regeneration.

These hypotheses must be benchmarked. They are not accepted as product facts until the quality and cost gates in this document pass.

## 3. Product modes

| Mode | Typical subjects | Generation representation | Default longest axis |
|---|---|---|---:|
| Architecture | houses, towers, bridges, temples | semantic primitives/BuildSpec | 24–32 |
| Object | balls, furniture, tools, props | hybrid primitives + RLE layers | 32–48 |
| Character | animals, humanoids, mascots | semantic parts + symmetry + RLE layers | 40–48 |
| Vehicle | cars, aircraft, ships | semantic parts + curves/wedges + RLE details | 40–48 |
| Pixel art | flat images and emblems | 2D run-length encoding | 32–64 |

The router detects the mode and shows it in the UI. The user can override the mode before generation.

## 4. Target pipeline

```text
Prompt and optional reference image
    |
    v
Prompt normalizer + intent router       Gemini Flash-Lite
    |
    v
Scene brief: subject, parts, proportions, palette, focal features
    |
    v
Encoding generator                       Gemini 3 Flash for complex objects
    |                                     Flash-Lite for simple architecture
    v
VoxelSpec v2 candidate
    |
    v
Schema + semantic validator
    |
    v
Deterministic compiler
    |
    v
Canonical block array
    |
    +--> local structural checks
    |
    v
Four low-resolution renders
    |
    v
Vision evaluator                         Flash-Lite first
    |
    +--> accept
    |
    +--> one compact patch                Gemini 3 Flash only when needed
    v
Preview, edit palette and export
```

Fast mode skips the visual evaluator unless local validation detects a likely failure. Balanced mode evaluates every result and permits one patch. No standard request may perform more than two generative model calls after planning.

## 5. Model routing

Model identifiers remain server configuration, never UI constants.

### Initial experiment configuration

| Task | Initial model | Maximum output | Reason |
|---|---|---:|---|
| Intent + scene brief | `gemini-3.1-flash-lite` | 1,200 tokens | cheap, small structured task |
| Architecture candidate | `gemini-3.1-flash-lite` | 6,000 tokens | existing strong use case |
| Object/character candidate | `gemini-3-flash-preview` | 20,000 tokens | competitor-like quality/cost profile |
| Visual evaluation | `gemini-3.1-flash-lite` | 1,000 tokens | scoring and missing-feature list only |
| Targeted patch | `gemini-3-flash-preview` | 5,000 tokens | bounded correction only |

`gemini-3.5-flash` is not the default because its standard output price is significantly higher. It may be benchmarked offline but may only enter production if the acceptance improvement is large enough to reduce retries and total cost.

Search grounding is disabled. Thinking/reasoning output is limited where the API supports it. The provider adapter records prompt, output and thinking token counts separately.

## 6. Scene brief

The first call converts a free-form prompt into a stable target:

```json
{
  "mode": "character",
  "subject": "dark caped vigilante",
  "style": "readable Minecraft voxel statue",
  "orientation": "front_facing",
  "pose": "standing",
  "parts": [
    { "id": "body", "shape": "humanoid_torso", "importance": 1.0 },
    { "id": "head", "shape": "masked_head", "importance": 1.0 },
    { "id": "cape", "shape": "tapered_sheet", "importance": 0.95 },
    { "id": "ears", "shape": "paired_wedges", "importance": 0.9 },
    { "id": "belt", "shape": "band", "importance": 0.75 }
  ],
  "focalFeatures": ["pointed mask", "long cape", "yellow belt"],
  "palette": ["black", "dark_gray", "yellow", "skin"],
  "constraints": {
    "longestAxis": 48,
    "maxBlocks": 12000,
    "maxMaterials": 12
  }
}
```

The scene brief is visible to the user as editable chips. If the brief misunderstood the subject, the user can fix it before spending the larger generation call.

## 7. Candidate encodings to benchmark

The experiment compares three output contracts on exactly the same prompt fixtures.

### A. Explicit voxels

```json
{"v":[[12,0,9,0],[13,0,9,0],[14,0,9,1]]}
```

Advantages: maximum freedom and closest to the observed competitor approach.  
Risks: highest token count, duplicate coordinates and weak global consistency.

### B. Layer RLE

```json
{
  "l": [
    [0, [[9,12,14,0], [10,11,15,0]]],
    [1, [[9,11,15,0], [10,10,16,0]]]
  ]
}
```

Layer structure:

```text
[y, [[z, xStart, xEndInclusive, materialIndex], ...]]
```

Advantages: compact, arbitrary shape, easy to validate and deterministic.  
Risks: the model may lose consistency between layers.

### C. Hybrid semantic geometry + RLE patches

```json
{
  "g": [
    ["ellipsoid", "body", [10,5,9], [28,26,20], 0],
    ["ellipsoid", "head", [15,28,12], [18,16,16], 1],
    ["wedgePair", "ears", [17,42,14], [14,6,10], 1]
  ],
  "l": [
    [30, [[11,17,20,2]]],
    [31, [[11,16,21,2]]]
  ]
}
```

Advantages: global form stays coherent; RLE retains arbitrary details; lowest likely token count.  
Risks: requires a richer compiler and careful part ownership.

The winning encoding is chosen from measured quality, cost and compile success. The architecture does not assume that RLE automatically wins.

## 8. VoxelSpec v2

The normalized domain format is independent of the provider encoding:

```ts
interface VoxelSpecV2 {
  schemaVersion: "2.0";
  mode: "architecture" | "object" | "character" | "vehicle" | "pixel_art";
  name: string;
  bounds: [number, number, number];
  palette: PaletteEntry[];
  focalFeatures: FocalFeature[];
  parts: SemanticPart[];
  geometry: GeometryOperation[];
  layers: VoxelLayer[];
  symmetry?: SymmetryRule;
}
```

### Required primitives for the hybrid experiment

- box and hollow box;
- sphere and ellipsoid;
- cylinder and capsule;
- cone and frustum;
- wedge;
- disc, ring and band;
- polyline or bounded Bézier tube;
- extruded 2D polygon;
- mirror across X or Z;
- union, subtract and replace-material;
- RLE layer overlay.

Primitives are deterministic compiler functions. Gemini selects and parameterizes them; Gemini does not implement them.

### Coordinate rules

- Integer coordinates only.
- Origin is the minimum corner.
- Y is up.
- `xStart` and `xEnd` are inclusive.
- Runs are sorted by Y, then Z, then X.
- Later operations overwrite earlier operations.
- Carving is an explicit operation, never an arbitrary `air` material.
- Negative coordinates are invalid.

## 9. Validation and local quality checks

Reject a candidate before rendering when:

- a coordinate leaves bounds;
- a run is reversed or overlaps illegally;
- a material index is unknown;
- operations exceed configured limits;
- compiled blocks exceed the selected block budget;
- JSON contains unexpected commands, URLs or executable content;
- the structure is empty.

Warn or trigger evaluation when:

- the largest connected component is below 85% of all blocks;
- a declared high-importance part has no blocks;
- the object touches more than two opposite bounds unexpectedly;
- symmetry was requested but the occupancy difference is high;
- the object occupies less than 35% of its volume envelope;
- thin parts are disconnected;
- the palette differs from the scene brief.

## 10. Rendering and visual evaluation

Render four 384×384 images locally from fixed cameras:

- front orthographic;
- left orthographic;
- rear orthographic;
- isometric perspective.

The evaluator receives the scene brief, optional user reference and four renders. It must return structured data only:

```json
{
  "subjectMatch": 0.84,
  "silhouette": 0.79,
  "paletteMatch": 0.92,
  "featureScores": [
    ["pointed mask", 0.9],
    ["long cape", 0.55],
    ["yellow belt", 0.95]
  ],
  "missing": ["cape too short"],
  "decision": "patch"
}
```

Automatic acceptance requires:

- subject match at least 0.75;
- no importance-1.0 focal feature below 0.65;
- local structural validation passed;
- no unsupported-content warning.

Scores are signals, not truth. Human benchmark ratings remain the release authority.

## 11. Patch contract

The repair call may only return compact changes:

- add/remove/transform one semantic part;
- replace a material in a bounded region;
- add or remove RLE runs;
- thicken a disconnected feature;
- mirror a feature;
- rescale one part around an anchor.

It may not regenerate the complete structure. A patch must compile deterministically against the original candidate and must remain inside the original cost and block budgets.

Only one automatic patch is permitted. If the result remains below threshold, show `Needs review` and let the user choose whether to try again.

## 12. Reference-image policy

- Do not automatically search the web for images.
- Allow an optional user-provided photo or drawing.
- Resize to at most 1,600 px and remove EXIF before sending.
- Use the reference only for the active generation unless the user saves it.
- Delete temporary originals after 24 hours.
- Never reuse a private user reference in the public gallery.
- Detect protected-character names and warn about rights without silently changing the prompt.

An obscure object with low router confidence should prompt: `Add a reference image for a more accurate result.`

## 13. Cost controls

### Per-request budgets

| Stage | Target output tokens | Hard stop |
|---|---:|---:|
| Scene brief | 400–800 | 1,200 |
| Architecture | 1,000–4,000 | 6,000 |
| Object candidate | 5,000–14,000 | 20,000 |
| Evaluation | 200–600 | 1,000 |
| Patch | 1,000–3,000 | 5,000 |

### Target economics

- Blended standard generation cost: at most $0.03 average.
- 95th-percentile standard generation cost: at most $0.08.
- No automatic third model call after a patch.
- One active generation per user.
- No public API or automated/bot access in the consumer pass.
- Cache successful plans, compiled voxels, renders and exports.
- Palette edits, camera changes and exports never call AI.
- Gallery downloads and remixes of an unchanged result never call AI.

The €0.99/48-hour pass is not approved solely because a single request is cheap. It requires real cohort data:

```text
expected AI cost per pass buyer
+ payment cost
+ hosting/storage allocation
< target COGS share of net payout
```

Before launch, record generations per pass buyer at median, P75, P90 and P95. If heavy human usage makes the pass structurally loss-making, change price or scope before public sale.

## 14. Provider telemetry

Store for every job:

- provider and exact model ID;
- prompt-template version;
- encoding experiment arm;
- input, output, cached and thinking tokens;
- estimated and measured provider cost;
- latency per stage;
- schema success and repair count;
- compiled block count, dimensions and palette count;
- local validation warnings;
- evaluator score;
- user action: accepted, improved, regenerated, downloaded or abandoned.

Prompts and reference images are not written to general application logs.

## 15. Benchmark design

Use 80 fixed prompts:

- 20 architecture prompts;
- 15 everyday props;
- 15 animals and creatures;
- 10 generic humanoid characters;
- 10 vehicles and machines;
- 5 unusual/novel objects;
- 5 intentionally unsupported prompts.

At least 20 fixtures specify two or more focal features, for example:

- rubber duck with pirate hat;
- astronaut cat with clear helmet;
- dark caped vigilante with pointed mask and yellow belt;
- red biplane with two wings and exposed propeller;
- soccer ball with black and white panels;
- watering can with top handle and long spout.

Do not tune the prompt against only these six examples. The hidden portion of the benchmark remains unchanged during prompt development.

### Experiment arms

1. Current BuildSpec baseline.
2. Explicit voxel list with Gemini 3 Flash.
3. Layer RLE with Gemini 3 Flash.
4. Hybrid primitives + RLE with Gemini 3 Flash.
5. Hybrid with Flash-Lite routing for simple cases.

Use the same prompt, size, palette constraint and evaluation rubric. Record at least three seeds per prompt for the final two candidates.

### Human rubric

Each result is rated blindly from 1–5:

- immediate subject recognizability;
- focal-feature correctness;
- silhouette and proportion;
- palette/material adherence;
- usefulness as a Minecraft build;
- willingness to download.

## 16. Acceptance and stop gates

### Milestone acceptance

- At least 95% schema-valid first-pass responses.
- At least 99% compile success after schema validation.
- At least 80% of supported prompts immediately recognizable.
- At least 85% of declared focal features present.
- At least 70% human download willingness score of 4 or 5.
- Median generation time below 45 seconds.
- P95 generation time below 90 seconds.
- Average provider cost at or below $0.03.
- P95 provider cost at or below $0.08.

### Stop or narrow the product when

- no encoding reaches 70% recognizability after two prompt/compiler iterations;
- visual evaluation does not improve human acceptance by at least 10 percentage points;
- the patch call frequently damages previously correct features;
- average cost remains above $0.08;
- 48³ output does not preserve the focal details users care about.

If a stop gate triggers, keep architecture mode and narrow object generation instead of adding unlimited retries or expensive mesh generation to the standard pass.

## 17. Implementation milestones

### Milestone 0 — fixtures and telemetry

- Create the 80-prompt fixture file.
- Add token/cost/latency result records.
- Capture the current Gemini baseline.
- Add a benchmark CLI that never writes production data.

Exit: one command produces a baseline report.

### Milestone 1 — VoxelSpec v2 compiler

- Add domain types and JSON Schema.
- Implement RLE expansion and canonical sorting.
- Implement ellipsoid, capsule, cone, wedge, ring and bounded curve primitives.
- Add symmetry, semantic part ownership and patch application.
- Add unit, property and golden-fixture tests.

Exit: hand-authored fixtures compile deterministically with no AI.

### Milestone 2 — encoding experiments

- Add server-side prompt templates for explicit, RLE and hybrid encodings.
- Add configurable model routing.
- Run a small 20-prompt development set.
- Eliminate encodings that fail schema, quality or cost gates.
- Run the full benchmark only after the small set is stable.

Exit: one encoding is selected with evidence.

### Milestone 3 — multi-view evaluator

- Add deterministic render cameras.
- Produce four low-resolution image artifacts.
- Add structured evaluator response.
- Add compact patch schema and one patch attempt.
- Compare acceptance with and without evaluation.

Exit: evaluation improves human acceptance by at least 10 percentage points without exceeding cost targets.

### Milestone 4 — creator UI integration

- Add detected mode and focal-feature chips.
- Add 24/32/40/48 size control.
- Show named generation stages.
- Add confidence and missing-feature messages.
- Add `Improve match`, palette edit and export.
- Keep prompt and preview visible side by side on desktop.

Exit: the full workflow is usable without developer diagnostics.

### Milestone 5 — private economics test

- Invite a small allowlisted user group.
- Measure real generations per user/pass.
- Measure acceptance, download, regeneration and abandonment.
- Simulate the €0.99 pass from actual usage.
- Decide price and included quality tier only from cohort data.

Exit: product owner signs off on unit economics before payments are enabled.

## 18. Proposed source layout

Keep the current repository structure during the experiment:

```text
server/
  generation/
    router.mjs
    scene-brief.mjs
    provider-registry.mjs
    prompt-templates/
    validators/
    telemetry.mjs
src/
  domain/
    voxel-spec-v2.ts
    voxel-spec-v2.schema.json
  compiler/
    compile-voxel-spec.ts
    primitives/
    rle.ts
    patches.ts
  evaluation/
    render-views.ts
    quality-report.ts
  features/create/
    CreateWorkspace.tsx
    InputPanel.tsx
    GenerationProgress.tsx
    ResultDock.tsx
benchmarks/
  prompts.json
  runner.mjs
  reports/
```

Do not migrate frameworks or add payments during the encoding experiment. First prove generation quality and cost in the existing local application.

## 19. Definition of success

The experiment succeeds when BlockDraft can generate a new, previously unseen supported object from text alone, render it recognizably at Minecraft scale, preserve the prompt’s important features, compile safely, and stay within the measured cost target without a mesh-generation API.

The experiment does not succeed merely because JSON is valid or a block preview appears.
