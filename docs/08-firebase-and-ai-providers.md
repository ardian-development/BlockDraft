# Firebase and AI provider decision

## Decision

For the first real backend iteration use Firebase as one coherent stack:

- Firebase Authentication for registration and login.
- Cloud Firestore for profiles, projects, structure versions, gallery entries, reactions and moderation records.
- Cloud Storage for exports, preview images and optional compiled artifacts.
- Cloud Functions (2nd gen) for privileged generation jobs, credit ledger writes, payment webhooks and moderation actions.
- Firebase Local Emulator Suite for local Auth, Firestore, Storage and Functions development.

Do not combine Firebase Auth with Supabase Postgres in the first implementation. A hybrid can be valid later, but it introduces two identity/security systems and makes local debugging harder. Supabase remains an alternative if relational reporting, SQL-heavy analytics or a migration away from Firebase becomes important.

Firebase Authentication supports email/password and federated providers such as Google; the Firebase Local Emulator Suite can emulate Authentication, Firestore, Storage and Functions for local prototyping. The emulator is for development/testing, not a production self-hosted replacement. See the official [Firebase Authentication documentation](https://firebase.google.com/docs/auth), [Local Emulator Suite](https://firebase.google.com/docs/emulator-suite) and [Auth emulator connection guide](https://firebase.google.com/docs/emulator-suite/connect_auth).

## Current code status

The local MVP currently has:

- no Firebase SDK dependency;
- no real account registration/login;
- no Firestore or Storage persistence;
- no public gallery backend;
- no implemented Remix button or Remix persistence;
- local prompt history only in React memory;
- a local FakePlanner and deterministic compiler.

The requirements and API design already include remix, gallery, project history, moderation, credits and authentication. They are planned contracts, not finished features.

## Remix implementation definition

Remix is a copy-on-write operation:

1. User opens a public approved gallery version.
2. `Remix` creates a new private project owned by the current user.
3. The new project references `sourceGalleryEntryId` and `sourceVersionId` for attribution.
4. The copied BuildSpec and compiler version become independent; changing the source never changes the remix.
5. The remix can be edited, regenerated, published or deleted normally.

Firestore shape:

```text
users/{uid}
projects/{projectId}
projects/{projectId}/versions/{versionId}
gallery/{galleryId}
gallery/{galleryId}/reactions/{uid}
reports/{reportId}
```

Creation of a remix should happen through a callable/HTTP Function, not an unrestricted client copy. The function verifies login, source visibility, rate limits and attribution fields before writing the new project.

## AI provider decision

Only one generative AI provider is required for the MVP. The provider must return structured JSON matching the BuildSpec schema. The model must be called from a server-side Cloud Function; never put the provider key in Vite/browser code.

### Recommended first provider: Gemini

Use a low-cost/fast Gemini model exposed through the Google GenAI SDK or Vertex AI adapter. Gemini supports structured output with JSON Schema and Zod, which directly matches the BuildSpec contract. The schema still needs application-level semantic validation because syntactically valid JSON can contain bad geometry. See [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output?lang=rest).

This is the most natural first experiment because the project already uses Firebase and the Google ecosystem, but Firebase does not force the use of Gemini.

### Supported alternative: OpenAI

Implement the same `StructurePlanner` adapter for OpenAI structured model outputs. OpenAI documents structured model outputs as a way to constrain responses to a schema. Keep the provider behind the same interface so quality, latency and cost can be compared with the same 100-prompt evaluation set. See [OpenAI structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

### Optional local provider: Ollama

An Ollama adapter can be added for offline experimentation. It is not the recommended quality baseline: local models may need more prompt tuning and adequate GPU/RAM. It is useful for tests and privacy-sensitive development, not required for the first alpha.

### Providers not required for MVP

- No image generator: the MVP creates deterministic block geometry, not marketing images.
- No 3D mesh generator: Three.js previews compiled blocks; a mesh service would solve a different problem.
- No embeddings/vector database: the first prompt set is small and can use ordinary Firestore/template queries.
- No moderation AI initially: use allowlists, text rules, reports and manual review; add a moderation provider after usage data exists.

## Required secrets/configuration

Development with emulators:

```text
VITE_FIREBASE_API_KEY=fake-api-key
VITE_FIREBASE_AUTH_DOMAIN=demo-voxelblueprint.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-voxelblueprint
VITE_USE_FIREBASE_EMULATORS=true
AI_PROVIDER=fake
```

Cloud development/production adds server-only:

```text
AI_PROVIDER=gemini
GEMINI_API_KEY=...
# or, in the alternative adapter:
OPENAI_API_KEY=...
```

Never expose `GEMINI_API_KEY`, `OPENAI_API_KEY`, Firebase Admin credentials or payment secrets under `VITE_*` variables.

## Local network plan

Run Vite on `0.0.0.0` as the current README describes. Run Firebase emulators on the development machine. A browser on the same LAN uses the host machine's LAN IP for the Vite app; the app's API calls should use a LAN-reachable Functions emulator address during development. Restrict Windows Firewall to Private networks and never expose emulator ports to the public internet.

## Migration trigger

Reconsider Supabase/Postgres only if one of these becomes a real bottleneck:

- complex gallery/search/reporting queries;
- large-scale credit/accounting reports;
- team permissions requiring relational joins;
- Firestore read costs or query/index limits dominate;
- SQL analytics becomes more important than Firebase integration speed.

