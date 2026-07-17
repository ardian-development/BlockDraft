# fal.ai provider and launch plan

## Decision

fal.ai can be integrated as a provider gateway, but its API key must never be shipped to the browser. The current Vite MVP is client-only, so a server-side proxy or worker is required before any fal call is added.

fal.ai is a strong fit for image/vision and optional image-to-3D reference workflows. It is not automatically the source of truth for a Minecraft BuildSpec: generic 3D models produce meshes, while BlockDraft needs bounded, validated block operations. The canonical pipeline remains:

```text
prompt/photo -> provider adapter -> normalized scene description -> BuildSpec -> validator -> compiler -> preview/export
```

## Provider roles

### Initial recommendation

- Current local default: Google Gemini `gemini-3.1-flash-lite` through the server adapter for fast, low-cost structured plans. `gemini-3.5-flash` remains the opt-in quality profile.
- Text prompt to structured `BuildSpec`: Gemini or OpenAI structured output.
- Photo reference to scene description: fal.ai vision model or Gemini/OpenAI vision adapter.
- Optional photo-to-mesh preview: fal.ai 3D model (for visual reference only, not direct `.mcfunction` export).
- Deterministic block placement: BlockDraft compiler, never the provider.

### Why not use a generic 3D model as the first export path?

A mesh-to-voxel conversion introduces camera/scale/material ambiguity and makes hidden geometry difficult to validate. It can be a later feature, but it would weaken the predictable 32³/5,000-block BuildSpec contract if used as the primary path.

## Server boundary

Use a server route or worker such as `/api/generate`:

1. Verify the Firebase ID token.
2. Validate prompt, image metadata, target version and requested size.
3. Reserve the user's quota/credits in Firestore.
4. Submit the normalized request to fal.ai or the selected text provider.
5. Validate provider output against the BuildSpec schema.
6. Allow at most one repair attempt.
7. Compile, persist the result and settle/refund the quota.
8. Return a job status and result to the browser.

The browser may receive a job ID and status updates, but never receives `FAL_KEY`, Gemini keys or OpenAI keys. fal.ai documents server-side proxying for this reason and supports queued requests with submit/status/result operations. References: [fal server-side integration](https://fal.ai/docs/documentation/model-apis/inference/server-side) and [fal JavaScript queue API](https://fal.ai/docs/api-reference/client-libraries/javascript/queue).

## Environment variables

Client-safe Firebase values remain `VITE_FIREBASE_*`. Provider credentials are server-only:

```text
FAL_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
```

Never use `VITE_FAL_KEY`, `VITE_GEMINI_API_KEY` or `VITE_OPENAI_API_KEY`.

## Model selection policy

Do not hard-code a marketplace model directly into UI code. Store a server-side provider registry:

```text
provider: fal
capability: vision_reference | image_to_3d_preview
endpoint: <approved fal model endpoint>
modelVersion: <recorded version>
maxImageBytes: 8388608
enabled: false
```

Every provider job stores provider, endpoint, model/version, latency, input/output sizes, estimated cost, status and validator outcome. New models are feature-flagged and tested on a fixed 20–100 prompt/photo fixture set before being enabled.

## Safe local test with fal.ai

1. Keep the current FakePlanner for normal UI development.
2. Add a local server/worker adapter that reads `FAL_KEY` from a non-committed environment file.
3. Run one manually approved test image and log only metadata/result status, not private image content.
4. Compare the normalized scene description against the same photo processed by the fallback provider.
5. Do not expose the local fal endpoint to the whole LAN until authentication and rate limits are active.

## Launch gates

### Gate 0: local integration

- Firebase Auth sign-up/sign-in works.
- A signed-in user can create/read their own Firestore profile and project.
- Anonymous users cannot read/write private data.
- FakePlanner still works without any provider key.

### Gate 1: private online alpha

- Deploy static web frontend to a temporary Firebase Hosting URL.
- Deploy the server-side generation route separately.
- Enable Firebase App Check, request validation, quota reservation, logging and budget alerts.
- Use fal.ai only for a small allowlisted test group.
- Keep photo originals temporary and private.

### Gate 2: public beta

- Custom domain `blockdraft.com` with HTTPS and canonical redirect.
- Firestore/Storage rules tested in Emulator Suite and deployed from version control.
- Provider cost per successful build measured and capped.
- Privacy policy, terms, deletion/export flow and contact/imprint published.
- Monitoring, error reporting and a kill switch tested.

## Can we go live now?

Not as a public AI SaaS yet. The frontend can be deployed as a private preview, but the current MVP still uses FakePlanner, has no Firestore project persistence in the UI and has no server-side fal route. Going live publicly before those gates would expose an incomplete product and make AI cost/abuse control impossible.

The correct next implementation order is: Firestore smoke test, project persistence, server-side provider adapter, one fal.ai test model, security rules/App Check, private hosting preview, then custom-domain launch.
