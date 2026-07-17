# BlockDraft

BlockDraft is an independent, AI-assisted Minecraft structure SaaS. Primary domain: `blockdraft.com`. The repository folder remains `2026-07-VoxelBlueprint` for continuity. The product UI and public content are English-first. This project must not copy BlockArchitect code, branding, UI text, prompts, gallery data or private APIs.

## Product promise

Describe a small or medium Minecraft build, inspect it in a fast 3D preview, refine it and export a safe Java Edition `.mcfunction` file that builds relative to the player or command origin.

## MVP target

- Minecraft Java Edition, one explicitly configured game version.
- Architecture, objects, animals, characters and vehicles up to 32 x 32 x 32 and 5,000 occupied blocks.
- Prompt, seven presets, palette and size controls.
- Gemini two-pass scene compiler: Gemini creates a semantic part plan, then a deterministic local compiler creates the validated ExplicitVoxelSpec v3.
- WebGL preview, project history, download and public/private visibility.
- Email/password and Google login through Firebase.
- One free generation per day; payments remain feature-flagged until retention is proven.
- Curated public gallery with remix.

## Recommended stack

- Current local MVP: Vite, React, TypeScript and Three.js.
- Target web/API: Next.js + TypeScript, App Router, Tailwind and Zod.
- 3D: Three.js through React Three Fiber; `InstancedMesh` grouped by material.
- Data/Auth/Storage: Firebase Auth, Firestore and Cloud Storage for the first cloud phase.
- AI: provider interface with structured JSON output; no provider-specific types outside the adapter.
- Validation/tests: Zod, Vitest and Playwright.
- Hosting: a free-tier compatible Node deployment. Generation processing stays behind a worker interface so hosting can change.

## Source layout to implement

```text
apps/
  web/                 Next.js UI and route handlers
  worker/              generation-job processor
packages/
  domain/              types, schemas, policies
  voxel-domain/        Explicit voxel validator, normalizer and canonical compiler
  block-registry/      versioned block allowlists and preview metadata
  exporters/           Java mcfunction first; more adapters later
  renderer/            Three.js scene and block instancing
  ai/                  provider adapters and prompts
  observability/       events, metrics and redaction
firebase/
  firestore.rules
  storage.rules
specs/
  build-spec.schema.json
docs/
```

## Build order

1. Implement and test the explicit-voxel contract without AI.
2. Render compiled fixtures in the browser.
3. Export fixtures and validate them in a disposable Minecraft test world.
4. Add projects, auth and storage.
5. Add Gemini structured-output planning, local shape compilation and one complete repair attempt.
6. Add credits, gallery, moderation and analytics.
7. Add payments only after activation and retention thresholds are met.

## Run locally on the home network

Requirement: Node.js 20+.

```powershell
cd E:\codekreativ\2026-07-VoxelBlueprint
npm install
npm run dev:api
```

In a second PowerShell window, start the web app:

```powershell
cd E:\codekreativ\2026-07-VoxelBlueprint
npm run dev
```

Open on the development computer:

```text
http://localhost:5173
```

Open on another device on the same network:

```text
http://<IP-OF-DEVELOPMENT-COMPUTER>:5173
```

The Vite server binds to `0.0.0.0` and is therefore reachable on the LAN. If Windows Defender asks, allow access on private networks. With `VITE_AI_PROVIDER=gemini`, the Vite `/api` proxy forwards requests to the local server on port `8787`; the Gemini key stays server-side.

## Firebase local phase

The Firebase CLI and a Java JDK are required for the Firestore/Storage emulators:

```powershell
firebase emulators:start --project demo-voxelblueprint
```

The emulator configuration is in [firebase.json](firebase.json), with rules in [firestore.rules](firestore.rules) and [storage.rules](storage.rules). The auth panel stays in local-demo mode until `VITE_FIREBASE_*` configuration is present.

## Production build and preview

```powershell
npm run build
npm run preview
```

## Definition of MVP success

- At least 70% of accepted prompts compile without a repair call.
- At least 90% compile after one repair call.
- At least 60% of new users reach a successful preview.
- At least 30% of successful previews result in a download.
- D7 creator retention is at least 15% before paid acquisition.
- AI plus infrastructure cost per successful generation is below 15% of target revenue per generation.

Read the current product-generation decision first: [Visual Reconstruction v4](docs/19-visual-reconstruction-v4.md). [Explicit Voxel v3](docs/18-explicit-voxel-v3-rebuild.md) remains the canonical output and guarded benchmark, but direct language-model-to-coordinate generation is not approved as the final universal-quality path. Earlier plans 14, 16 and 17 are historical.
