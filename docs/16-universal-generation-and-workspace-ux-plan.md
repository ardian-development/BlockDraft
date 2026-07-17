# Universal object generation and creator workspace plan

Status: creator-workspace UX remains active; mesh-generation sections are superseded for the default product  
Product: BlockDraft  
Primary domain: `blockdraft.com`

> Update 2026-07-14: the default arbitrary-object strategy has changed from a paid mesh-generation API to a low-cost Gemini voxel experiment. Hunyuan remains a premium/fallback option only. The canonical generation plan is now [Low-cost Gemini voxel generation](17-low-cost-gemini-voxel-generation-plan.md). The creator-workspace UX sections in this document remain valid.

## 1. Outcome

BlockDraft must support two different creation problems with two different deterministic backends:

1. **Playable architecture** uses the existing semantic BuildSpec/primitive compiler. It preserves hollow rooms, doors, roofs, repeated elements and editable materials.
2. **Arbitrary objects, props and characters** use a generated 3D mesh, followed by mesh cleanup, voxelization, Minecraft palette mapping and validation.

Trying to represent every new object as handcrafted boxes, cylinders and templates will remain static. Trying to use a generic mesh generator for architecture will produce solid sculptures rather than useful buildings. An intent router must select the correct pipeline.

Templates remain optional accelerators and fallbacks for common objects. A manually curated asset library is not a requirement for the universal object pipeline.

## 2. Supported scope

### First public object scope

- One isolated object, character, animal, vehicle, statue or prop.
- Text prompt or one reference image.
- Full object visible, neutral or removable background.
- Voxel output between 24 and 64 blocks on the longest axis.
- Surface-shell output by default; solid fill is optional.
- Minecraft-safe palette with no command blocks or unsafe block states.

### Explicitly later

- Multi-object scenes and landscapes.
- Functional interiors generated from a mesh.
- Animation, rigs and moving redstone mechanisms.
- Exact readable text, logos or tiny symbols.
- Very thin wires, feathers, fingers or transparent layers at low voxel resolution.
- Guaranteed replicas of protected commercial characters.

The UI must communicate these boundaries. “Any object” means broad open-domain generation, not a guarantee that every small detail survives at Minecraft resolution.

## 3. Generation architecture

```text
Prompt or photo
    |
    v
Intent router --------------------------+
    |                                   |
    | architecture                      | object / character / prop
    v                                   v
Semantic BuildSpec                Reference concept image
    |                             (skip when a photo exists)
    v                                   |
Primitive compiler                     v
    |                             Image-to-3D provider
    |                                   |
    |                                   v
    |                              GLB mesh asset
    |                                   |
    +------------------+----------------+
                       v
              Validator / voxel compiler
                       |
                       v
             Minecraft palette mapping
                       |
                       v
             Multi-view quality check
                       |
                       v
                Preview and export
```

### Why concept-image-first for text prompts

An image is a visible contract between the user and the expensive 3D step. The user can reject a wrong concept before paying for mesh generation. It also provides stronger shape and colour conditioning than a short text prompt. Microsoft’s official TRELLIS repository explicitly recommends image-conditioned generation over direct text conditioning for better detail: [TRELLIS](https://github.com/microsoft/TRELLIS).

The Fast mode may run the concept and mesh steps automatically. Balanced and Quality modes show the concept for approval first.

## 4. Provider decision

### Alpha provider

Use a provider adapter with fal.ai as the first implementation because the project owner already has an account. Benchmark these capabilities behind feature flags:

- Hunyuan 3D rapid image-to-3D for Fast mode. fal currently lists the v3.1 Rapid base generation at **$0.225 per successful generation**.
- Hunyuan 3D pro image-to-3D for Balanced/Quality mode. fal currently lists the Pro base generation at **$0.375 per generation**.
- Geometry-only output when colour can be projected from the approved reference.
- Textured output only when it materially improves Minecraft palette mapping.

fal.ai exposes Hunyuan text/image-to-3D endpoints and asynchronous job APIs. Current model availability is documented on the [Hunyuan 3D model family page](https://fal.ai/hunyuan-3d) and [Hunyuan 3D API reference](https://fal.ai/models/fal-ai/hunyuan3d/v2/api). Provider keys remain server-only.

### Benchmark alternatives

- [Meshy Text-to-3D API](https://docs.meshy.ai/en/api/text-to-3d): preview/refine workflow and GLB/FBX/OBJ output.
- [Tripo API](https://developers.tripo3d.ai/en/docs/quick-start): asynchronous text/image-to-model jobs with GLB output.
- [TRELLIS](https://github.com/microsoft/TRELLIS): open source and MIT-licensed core project, but official requirements include an NVIDIA GPU with at least 16 GB VRAM.

The current development computer has a GTX 1650 with 4 GB VRAM. It is not a viable host for TRELLIS inference. Local CPU voxelization is viable; generative mesh inference is not.

### Provider abstraction

```ts
interface MeshGenerationProvider {
  createFromImage(input: ImageToMeshInput): Promise<ProviderJob>;
  createFromText?(input: TextToMeshInput): Promise<ProviderJob>;
  getStatus(jobId: string): Promise<ProviderStatus>;
  getResult(jobId: string): Promise<MeshProviderResult>;
  cancel?(jobId: string): Promise<void>;
}
```

No provider-specific response may enter the domain or UI. The adapter returns normalized job state, GLB URL, preview URL, duration, model version and measured cost.

## 5. Mesh-to-Minecraft algorithm

The deterministic voxel worker is the core BlockDraft differentiator.

### 5.1 Mesh ingestion

1. Download the GLB through a server worker.
2. Validate content type, size and vertex/triangle limits.
3. Strip animation, cameras, lights, metadata and external URLs.
4. Normalize units, origin and Y-up orientation.
5. Remove tiny disconnected components and duplicate geometry.
6. Repair normals and holes where possible.
7. Scale to the selected longest-axis voxel resolution.

### 5.2 Voxelization

Use Open3D in a small Python worker for the first implementation. Open3D provides triangle-mesh to voxel-grid conversion through `create_from_triangle_mesh`: [Open3D voxelization](https://www.open3d.org/docs/latest/tutorial/geometry/voxelization.html).

Modes:

- `surface`: rasterize the exterior shell; default for statues and props.
- `solid`: flood-fill the interior; optional and more block-heavy.
- `adaptive`: preserve thin components by increasing local resolution before final downsampling.

Post-processing:

- 3D connected-component filtering.
- One-voxel morphological closing for small holes.
- Minimum-thickness preservation for limbs, ears, handles and wings.
- Support check for floating components.
- Tight-bounds normalization.
- Block-budget reduction using importance-weighted downsampling.

### 5.3 Colour and material mapping

1. For each surface voxel, find the nearest textured triangle or project the approved reference image.
2. Sample its colour in linear RGB.
3. Convert source and Minecraft palette colours to OKLab or CIELAB.
4. Select the closest allowed Minecraft block using perceptual distance.
5. Apply spatial smoothing so texture noise does not create a salt-and-pepper block pattern.
6. Limit the default palette to 8–16 blocks.
7. Exclude gravity blocks, animated/function blocks and version-incompatible blocks unless explicitly enabled.

Palette presets:

- Concrete: clean statues and characters.
- Wool: softer colour range.
- Natural: wood, stone and terrain props.
- Mixed: best perceptual match with a controlled allowlist.

### 5.4 Export

The canonical voxel payload becomes a sorted list of coordinates and block IDs. Existing `.mcfunction` export remains supported for small builds. Add `.schem` or `.litematic` after the voxel pipeline is stable because large statues can exceed practical one-command-per-block file sizes.

## 6. Quality system

A valid mesh is not automatically a correct result. Every generation receives a `QualityReport`.

### Automated checks

- Object fills 65–90% of the target bounds.
- No unexpected large disconnected components.
- Thin focal features survive voxelization.
- Block count and dimensions satisfy the selected tier.
- Front, side and three-quarter renders exist.
- Palette count is within the selected limit.

### Semantic checks

Render the voxel result from three fixed cameras. A vision evaluator receives the original prompt/reference plus those renders and returns only structured scores:

```json
{
  "subjectMatch": 0.86,
  "attributeMatch": 0.91,
  "silhouette": 0.82,
  "paletteMatch": 0.88,
  "missingFeatures": ["left handle"],
  "decision": "accept"
}
```

Only one automatic repair/regeneration is allowed in Balanced mode. Fast mode does not repair automatically. Quality mode may generate two mesh candidates and select the better scored result.

### Benchmark set and gates

Create at least 60 fixed fixtures:

- 15 simple props.
- 15 animals/characters.
- 10 vehicles and machines.
- 10 complex or unfamiliar objects.
- 5 photo inputs.
- 5 deliberately unsupported inputs.

Release targets:

- At least 85% human acceptance for supported single-object prompts.
- At least 90% retention of one or two explicitly requested focal attributes.
- At least 98% voxel compile success after receiving a valid GLB.
- Fast-mode median completion below 90 seconds.
- No job may exceed its configured provider budget without explicit confirmation.
- Unsupported prompts must receive a clear warning, not a misleading “successful” result.

## 7. Quality and cost tiers

| Tier | Pipeline | Resolution | Candidates | Repair | Current mesh base cost* | Purpose |
|---|---|---:|---:|---:|---:|---|
| Fast Draft | Rapid image/text-to-3D automatically | 32 | 1 | 0 | $0.225 | Quick shape test |
| Balanced | Approved concept + Rapid/Pro image-to-3D | 48 | 1 | Max 1 | $0.225–$0.375 | Default creation |
| High Fidelity | Approved/multi-view concept + Pro mesh | 64 | 2 | Max 1 | $0.375+ | Detailed statues |

\* Current fal.ai Hunyuan v3.1 base prices; concept-image generation, optional multi-view input and retries are separate billable calls. Exact prices must be read from the provider pricing API at runtime.

Provider prices are volatile. Store a server-side cost ceiling per endpoint, log actual provider cost and disable an endpoint automatically when its configured ceiling is exceeded. The UI shows an estimate before generation. Do not enable PBR for Minecraft voxel output by default: it adds $0.15 but is not needed for geometry or palette extraction. Do not request multi-view images in Fast mode; fal lists multi-view as an additional charge on the higher-quality endpoint.

## 8. Domain and API changes

### New domain records

```ts
type GenerationMode = "architecture" | "object" | "character" | "pixel_art";
type QualityTier = "fast" | "balanced" | "high";

interface GenerationJob {
  id: string;
  userId: string;
  mode: GenerationMode;
  quality: QualityTier;
  prompt: string;
  status: "queued" | "concept" | "awaiting_approval" | "mesh" | "voxelizing" | "evaluating" | "complete" | "failed";
  provider?: { name: string; model: string; externalJobId: string };
  estimatedCost?: number;
  measuredCost?: number;
}

interface MeshAsset {
  storagePath: string;
  sha256: string;
  triangleCount: number;
  textured: boolean;
  sourceProvider: string;
}

interface VoxelAsset {
  resolution: number;
  dimensions: { x: number; y: number; z: number };
  blockCount: number;
  palette: string[];
  payloadPath: string;
}
```

### API

- `POST /api/v1/generations` creates a job and reserves the maximum allowed credit.
- `GET /api/v1/generations/:id` returns normalized progress and artifacts.
- `POST /api/v1/generations/:id/approve-concept` starts the paid mesh step.
- `POST /api/v1/generations/:id/retry` performs a bounded retry.
- `POST /api/v1/generations/:id/cancel` cancels when the provider supports it.
- `GET /api/v1/generations/:id/export?format=mcfunction` returns a signed artifact URL.

Use Firestore for job/project metadata and Cloud Storage for temporary source images, concept images, GLBs, voxel payloads, preview renders and exports. Delete private raw inputs after the configured retention window.

## 9. Creator workspace UX

### Product decision

Separate the marketing page from the actual creator application:

- `/` is the expressive BlockDraft landing page.
- `/create` is a focused desktop workspace.
- `/gallery` is a dedicated browsing/remix page.

The current create page is vertically staged like a landing page, so the prompt and result cannot be compared continuously. On desktop, the creator must use a persistent two-column workspace.

### Desktop wireframe

```text
+--------------------------------------------------------------------------+
| BlockDraft       CREATE   GALLERY   PROJECTS              Credits  User  |
+---------------------------+----------------------------------------------+
| INPUT                     | CANVAS                              [tools]  |
| [Text] [Image]            |                                              |
|                           |              live 3D preview                  |
| Describe the object       |                                              |
| +-----------------------+ |                                              |
| |                       | |                                              |
| +-----------------------+ |                                              |
|                           |                                              |
| Detected: Object          +----------------------------------------------+
| Quality: Balanced         | 48 x 44 x 31   8,420 blocks   12 materials  |
| Size: 48                  | [Improve] [Palette] [Download]               |
| Palette: Concrete         |                                              |
| Est. time / cost          | Generation timeline / warnings               |
| [ Generate blueprint ]    |                                              |
+---------------------------+----------------------------------------------+
```

### Grid

- Header: 68–72 px, sticky.
- Desktop workspace: `grid-template-columns: 390px minmax(0, 1fr)`.
- Maximum workspace width: 1,600 px with 24–32 px outer padding.
- Workspace height: `calc(100svh - header - 24px)` with internal panel scrolling.
- Left panel width remains stable; the 3D canvas receives all additional width.
- Below 900 px, stack input above canvas and keep Generate as a sticky bottom action.

### Left control panel

Order controls by decision frequency:

1. Text/Image segmented input.
2. Prompt or photo drop zone.
3. Detected mode with manual override.
4. Quality tier with time/cost estimate.
5. Longest-axis size: 24, 32, 48 or 64.
6. Palette preset.
7. Advanced: shell/solid, detail preservation, background removal.
8. Primary Generate button.

Do not expose provider names, polygon counts or topology controls in the default view. Those belong in diagnostics or advanced settings.

### Right canvas panel

- Viewer occupies at least 70% of the workspace height.
- Floating toolbar: fit view, front, side, isometric, grid, background.
- Progress appears inside the canvas as named stages, not a generic spinner.
- Result dock shows dimensions, block count, palette count and confidence.
- Primary result actions: Improve match, Edit palette, Export.
- Secondary actions: regenerate, duplicate, make public.

### Visual language

Reuse the useful information architecture of a side-by-side builder without copying BlockArchitect’s visual expression.

BlockDraft identity:

- Calm cyan/ice workspace background instead of a dark repeating cube wallpaper.
- Off-white control surface with dark navy text for readability.
- Dark navy 3D canvas to maximize voxel contrast.
- Cyan primary action with a restrained lime highlight for success/selection.
- Space Grotesk for headings and Inter for UI text.
- Pixel typography only for tiny build metrics, never for paragraphs or buttons.
- 14–18 px card radii; buttons use 12–14 px radii rather than every control being a pill.
- Subtle one-pixel borders and short shadows; no glowing neon panels.
- One icon family with 18/20 px line icons.

Suggested tokens:

```css
--page: #dff8fc;
--surface: #f8fcfd;
--surface-strong: #ffffff;
--canvas: #091827;
--ink: #0d2230;
--muted: #607681;
--line: #c8e1e6;
--brand: #20c6dc;
--brand-hover: #13b5cc;
--highlight: #c9f36a;
--danger: #e85d65;
```

### UX states

Implement and test these states explicitly:

- Empty: useful sample object and short supported-scope explanation.
- Concept generation: stage label and cancel action.
- Awaiting concept approval: approve, edit prompt, try another concept.
- Mesh generation: progress with honest time estimate.
- Voxelization: local deterministic stage.
- Quality warning: missing feature list and one-click Improve Match.
- Complete: preview, metrics, palette, export.
- Failure: preserve the prompt and explain whether provider, mesh or validation failed.

## 10. Current frontend cleanup

The current stylesheet contains multiple generations of the design layered over each other: the old `.workspace` rules, the centered `.create-page` rules and a later cyan skin override the same selectors. Before implementing the workspace, consolidate them into:

```text
src/styles/
  tokens.css
  base.css
  shell.css
  creator-workspace.css
  components.css
  responsive.css
```

Create components instead of keeping the application in one JSX return block:

```text
src/features/create/
  CreateWorkspace.tsx
  InputPanel.tsx
  PromptInput.tsx
  QualitySelector.tsx
  GenerationProgress.tsx
  PreviewCanvas.tsx
  ResultDock.tsx
```

## 11. Delivery plan

### Milestone 0 — baseline

- Freeze 60 prompt/photo fixtures.
- Record current acceptance, latency, cost and block count.
- Add job/provider/cost telemetry schema.

Exit: reproducible benchmark report exists.

### Milestone 1 — provider-independent voxel worker

- Accept fixture GLB files.
- Normalize and voxelize with Open3D.
- Implement surface/solid modes and palette quantization.
- Return canonical voxel payload and three preview renders.
- Unit-test bounds, determinism, palette allowlist and connected components.

Exit: 20 diverse fixture meshes compile deterministically.

### Milestone 2 — fal.ai mesh adapter

- Add server-only `FAL_KEY`.
- Implement queue submit/status/result.
- Store provider GLB privately.
- Enforce timeout, size, cost and retry limits.
- Connect photo-to-object first, then prompt-to-concept-to-object.

Exit: one prompt and one photo complete end-to-end without exposing a key.

### Milestone 3 — creator workspace

- Split marketing and create routes.
- Implement the two-column desktop workspace.
- Add Text/Image modes, quality estimate and named progress stages.
- Keep current Three.js block viewer, replacing only its surrounding UI.
- Implement responsive stacked layout.

Exit: desktop input and output remain visible together at 1280 px and above; all primary flows work at 390 px mobile width.

### Milestone 4 — quality gate

- Add multi-view voxel renders.
- Add structured visual evaluation.
- Add one bounded Improve Match flow.
- Run the 60-fixture benchmark across candidate providers.

Exit: supported-prompt acceptance reaches 85% and focal attributes reach 90%.

### Milestone 5 — product hardening

- Firebase identity and private project persistence.
- Quotas, cost reservation, cancellation and budget kill switch.
- Input deletion policy, moderation and protected-character handling.
- `.schem`/`.litematic` export investigation.
- Private alpha with measured retention and cost.

## 12. Immediate implementation order

1. Do not add more hardcoded object templates before the voxel worker exists.
2. Build and test GLB-to-voxel conversion with locally stored permissive fixture meshes.
3. Add the fal.ai adapter for one image-to-3D endpoint.
4. Connect the existing photo upload to the new asynchronous job API.
5. Add prompt-to-concept only after photo-to-voxel works reliably.
6. Refactor the Create page into the two-column workspace.
7. Add the quality evaluator only after deterministic voxel output is stable.

This order isolates failures: first geometry conversion, then provider generation, then AI interpretation and finally UX automation.
