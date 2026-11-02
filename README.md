# BlockDraft

BlockDraft is an independent, AI-assisted Minecraft build studio. Describe an idea in plain language, inspect the resulting structure in an interactive 3D preview, refine it, and export a safe Minecraft Java Edition `.mcfunction` file.

The project is designed around a practical principle: AI proposes a compact, structured plan, while deterministic application code validates and compiles the final voxel model. That keeps the export predictable, testable and safe to run in a Minecraft world.

> BlockDraft is an original project. It does not copy another product's code, branding, UI text, prompts, gallery data or private APIs.

## What it does

- turns a natural-language description into a build concept, such as a house, vehicle, creature or decorative object;
- generates a structured scene/part plan with an AI provider;
- compiles the plan into a validated voxel specification with explicit size and block-count limits;
- previews the build in the browser using Three.js;
- exports a relative Java Edition `.mcfunction` file for use in a chosen Minecraft version.

## How the generation pipeline works

```text
Prompt + optional image reference
              │
              ▼
AI scene / part plan (structured JSON)
              │
              ▼
Schema validation + semantic checks
              │
              ▼
Deterministic voxel compiler
              │
              ├── Three.js preview
              └── Minecraft Java .mcfunction export
```

AI-provider credentials are intentionally server-side only. The repository contains configuration examples and documentation, never real keys.

## Current scope

The repository contains an actively evolving local MVP and the accompanying product, architecture and implementation documentation. The public roadmap below describes the intended production architecture; individual modules are introduced incrementally as the project matures.

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
