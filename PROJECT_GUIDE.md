# BlockDraft – Agentic Developer Project Guide

This file is the operational handover for BlockDraft. Read it before changing the generator, renderer, API or Firebase integration.

## 1. Product and current scope

BlockDraft is an English-first web MVP that turns a natural-language request into a Minecraft Java voxel blueprint. The user enters a prompt, receives a validated 3D preview, and can export a relative `.mcfunction` file.

The current product is a local/LAN MVP. It is not yet a production SaaS. Firebase authentication is present as a client integration, while generation runs through the local Node API. The product must remain Gemini-only unless the owner explicitly changes that decision.

Current hard limits:

- Minecraft block IDs must be valid/safe allowlisted-style IDs.
- Maximum occupied blocks: 5,000.
- Maximum axis size: 32 × 32 × 32.
- Generation modes: architecture, object, character, vehicle and pixel_art.
- Output contract: ExplicitVoxelSpec v3, then compiled Minecraft Java commands.

## 2. Runtime architecture

```text
React/Vite browser
  ├─ prompt, size and optional image reference
  ├─ visible generation-stage status
  └─ Three.js voxel preview
          │ POST /api/generate
          ▼
Node server/index.mjs
  ├─ detect mode
  ├─ Gemini prompt/brief pass (optional but enabled by default)
  ├─ Gemini semantic PartPlan pass
  ├─ local primitive compiler
  ├─ symmetry completion for non-architectural models
  ├─ disconnected-part bridge
  ├─ ExplicitVoxelSpec v3 normalizer/validator
  └─ JSON response + diagnostics + token usage
          │
          ▼
src/explicitVoxel.ts
  ├─ client-side canonical compile/check
  └─ .mcfunction export
```

The important design boundary is: Gemini interprets the request; local code owns geometry safety, limits, connectivity and export. Do not move thousands of explicit coordinates back into the model unless this is an intentional experiment.

## 3. Active generation pipeline

### Stage A – prompt brief

`optimizePrompt()` calls `GEMINI_PROMPT_MODEL` (default `gemini-3.1-flash-lite`) and asks for a compact JSON brief containing subject, silhouette, palette, focal features, orientation and constraints. If this call fails, generation continues using the original prompt.

### Stage B – semantic PartPlan

`generatePartPlan()` calls `GEMINI_VOXEL_MODEL` (default `gemini-3-flash-preview`) with a JSON schema. Gemini returns 5–24 semantic parts. A part has:

- `role` – for example body, head, eye, beak, roof, wing
- `shape` – box, ellipsoid, cylinder, cone or wedge
- integer `center` and `size`
- material index and optional hollow flag

The model is instructed to produce a complete primary volume, use +Y as up, +Z as front, and keep parts touching.

### Stage C – local compilation

`compilePartPlan()` converts each semantic part to voxels. It also:

- maps roles to robust Minecraft materials (eyes, beaks, roofs, wood, accents)
- inserts a fallback primary volume when Gemini returns only details
- grows a primary volume when the selected quality tier is too small
- mirrors severe left/right imbalance for non-architectural models
- bridges disconnected components using the shortest in-bounds Manhattan path
- emits diagnostics such as `partsReceived`, `voxelsBeforeValidation` and `disconnectedPartsBridged`

### Stage D – normalization and validation

`normalizeExplicitSpec()` removes invalid coordinates, deduplicates blocks, enforces the 5,000-block limit, checks minimum detail, keeps the largest connected component, remaps materials and validates requested colors/eyes.

If validation throws, `generateTwoPassModel()` requests a fresh PartPlan once. Do not silently swallow validation failures; they are important quality signals.

### Stage E – client compile and export

The browser receives `spec`, compiles it with `compileExplicitVoxelSpec()`, renders it in `Viewer.tsx`, and exports with `toMcfunction()`.

## 4. API contract

### Health

`GET /api/health`

Returns provider, active pipeline, selected Gemini models, configuration status and block limit.

### Generate

`POST /api/generate`

Request:

```json
{
  "prompt": "a detailed pirate ship",
  "size": "small|medium|large",
  "referenceImage": "optional data:image/... base64 string"
}
```

Important response fields:

- `spec` – canonical ExplicitVoxelSpec v3
- `optimization` – brief from Stage A, if available
- `scenePlan` – part count and mode
- `usage.prompt`, `usage.parts`, `usage.total` – Gemini token metadata when provided by the API
- `qualityReport` – block count, connected components, removed blocks, missing colors and compiler diagnostics
- `stages` – canonical pipeline stage names

Do not expose `GEMINI_API_KEY` or any other server secret to the browser.

## 5. File map

### Root

- `README.md` – short project overview and local start instructions.
- `PROJECT_GUIDE.md` – this handover document; update it when architecture changes.
- `.env.example` – safe environment template; never put real keys here.
- `.env.local` – local secrets/configuration; do not commit.
- `package.json` – scripts and dependencies.
- `vite.config.ts` – Vite configuration and `/api` proxy.
- `firebase.json`, `.firebaserc`, `firestore.rules`, `storage.rules` – Firebase setup/rules for the cloud phase.

### `server/`

- `server/index.mjs` – local HTTP API, Gemini calls, PartPlan schema, compiler, validators and diagnostics. This is the active backend.
- `generateTwoPassModel()` – top-level generation orchestrator.
- `generatePartPlan()` – Gemini semantic planning call.
- `compilePartPlan()` – deterministic geometry compiler.
- `bridgeDisconnectedStructure()` – connects separated parts before validation.
- `normalizeExplicitSpec()` – canonical safety/quality validator.

### `src/`

- `main.tsx` – React application, prompt composer, generation status, result cards and export actions.
- `Viewer.tsx` – Three.js instanced voxel renderer, camera, controls and bottom-up animation.
- `explicitVoxel.ts` – client-side ExplicitVoxelSpec v3 types, compiler and `.mcfunction` serializer.
- `types.ts` – shared compiled-structure types used by the viewer/UI.
- `AuthPanel.tsx` – Firebase email/password and Google auth panel.
- `firebase.ts` – Firebase initialization from `VITE_*` variables.
- `styles.css` – BlockDraft visual system and responsive layout.

### `docs/`

The numbered documents contain requirements, architecture, Firebase setup, UX/style decisions, cost analysis and generation experiments. `20-gemini-two-pass-scene-compiler.md` describes the active AI architecture. Older documents are historical plans and must not override this guide without an explicit decision.

### `specs/`

- `build-spec.schema.json` – earlier build-spec contract/reference. The active runtime output is ExplicitVoxelSpec v3 in `src/explicitVoxel.ts` and `server/index.mjs`.

## 6. Local development

Requirements: Node.js 20+.

```powershell
cd E:\codekreativ\2026-07-VoxelBlueprint
npm install
```

Start the API:

```powershell
npm run dev:api
```

Start the Vite app in a second terminal:

```powershell
npm run dev
```

Open:

- local: `http://localhost:5173`
- LAN: `http://<development-pc-ip>:5173`
- API health: `http://localhost:8787/api/health`

Verify before handing off:

```powershell
node --check server/index.mjs
npm run build
```

## 7. Environment variables

Server-only:

- `GEMINI_API_KEY` – required for real generation.
- `GEMINI_PROMPT_MODEL` – brief pass model.
- `GEMINI_VOXEL_MODEL` – PartPlan pass model.
- `GEMINI_PROMPT_OPTIMIZER=false` – optional emergency switch to disable Stage A.

Browser:

- `VITE_AI_PROVIDER=gemini` when using the local API.
- `VITE_FIREBASE_*` values for Firebase Auth.

Never use `VITE_GEMINI_API_KEY`; Vite variables are public in the browser bundle.

## 8. Debugging checklist

When only part of a model appears, inspect the API response in this order:

1. `scenePlan.partCount` – did Gemini return enough parts?
2. `qualityReport.partsReceived` – did the compiler receive them?
3. `qualityReport.voxelsBeforeValidation` – did primitives create a complete volume?
4. `qualityReport.disconnectedPartsBridged` – were parts spatially separated?
5. `qualityReport.detachedRemoved` and `connectedComponents` – did validation remove anything?
6. `spec.bounds` and `spec.dimensions` – was geometry clipped by bounds?
7. Viewer camera/animation – is the model present but temporarily hidden?

Do not fix a rendering symptom by changing camera logic before checking the server diagnostics.

## 9. Safe extension rules

- Keep Gemini calls behind server-side adapter functions.
- Preserve ExplicitVoxelSpec v3 compatibility for the viewer and exporter.
- Add new primitive shapes in `compilePartPlan()` with tests before exposing them to Gemini.
- Keep all generated coordinates bounded and connected.
- Add diagnostics for every new repair or fallback.
- Do not add fal.ai/OpenAI/Hunyuan calls without an explicit product decision.
- Do not commit `.env.local`, API keys, Firebase private credentials or generated user data.

## 10. Known limitations and next priorities

The current compiler improves completeness but does not guarantee photorealistic or IP-perfect reconstruction. Bilateral mirroring can be wrong for intentionally asymmetric objects. The next high-value work is automated fixture tests for mouse, duck, soccer ball, pirate ship and vehicle prompts, plus a UI diagnostics drawer showing the stage/token/repair metrics.
