# Product requirements

## 1. Scope and positioning

BlockDraft is a focused architectural copilot, not a general Minecraft world generator. It should be best at houses, towers, bridges, temples, pavilions, walls, arenas, rooms and modular building parts. It should decline or clearly warn about huge worlds, detailed faces, logos, text, copyrighted characters and requests requiring arbitrary commands.

Primary user: a 13+ Minecraft player or creator who wants a usable structure faster than building it block by block. Secondary users: server owners, map makers, educators and video creators.

MVP non-goals: terrain/world generation, multiplayer editing, arbitrary command generation, redstone logic, mobs, command blocks, Java mods, Bedrock export, pixel-art accuracy, mobile authoring and complete cities.

## 2. Main journey

1. Visitor sees examples and can rotate one demo without login.
2. Visitor enters a prompt and selects size, style and palette.
3. Login is requested only when generation starts.
4. UI creates a generation job and displays the stages: planning, compiling, validating, previewing.
5. On success the user sees the 3D model, dimensions, block/material counts and warnings.
6. User can regenerate, create a variation, change palette, rename, set visibility and download.
7. A public project may be submitted to moderation. Approved builds appear in the gallery.
8. Gallery visitors can inspect, download, save or remix a build.

## 3. Functional requirements

### Generation

- `GEN-001`: Prompt length 10-600 characters; trim, normalize and reject invisible/control characters.
- `GEN-002`: Inputs include prompt, size preset (`small`, `medium`, `large`), style, palette and optional negative instructions.
- `GEN-003`: Server calculates all quota/cost decisions. The client never decrements credits.
- `GEN-004`: AI returns only a valid BuildSpec conforming to the versioned schema.
- `GEN-005`: Compiler is deterministic: identical BuildSpec + compiler version produces identical block output hash.
- `GEN-006`: Limits: 32 per axis for architecture, 12,000 non-air blocks, 200 operations, 12 materials and 60-second job timeout.
- `GEN-007`: Validator rejects unknown blocks, unsupported block states, out-of-bounds coordinates, unsafe identifiers and excessive output.
- `GEN-008`: One structured repair call is allowed. A second failure refunds the reserved credit.
- `GEN-009`: Generation stores model provider, model identifier, prompt-template version, schema version, compiler version, latency and estimated cost.
- `GEN-010`: User can cancel only before model execution begins; quota reservation is then released.

### Photo reference mode

- `PHOTO-001`: User can optionally upload one JPG, PNG or WebP image up to 8 MB.
- `PHOTO-002`: Client resizes the image to a maximum 1600px longest edge and strips metadata before upload.
- `PHOTO-003`: User chooses `reference` (style/layout inspiration) or `reconstruct` (best-effort architectural approximation).
- `PHOTO-004`: The system clearly states that one perspective photo cannot provide exact hidden geometry; reconstruct mode must return confidence/warnings.
- `PHOTO-005`: The original image is deleted after processing by default. Long-term storage requires explicit user opt-in.
- `PHOTO-006`: The server sends the image only to the configured vision-capable AI provider, validates the returned BuildSpec and never accepts provider output as commands.
- `PHOTO-007`: Face, personal-data, logos and copyrighted-character warnings are shown before public submission; private images are never added to the public gallery automatically.
- `PHOTO-008`: Local MVP supports image selection, preview and a fake-reference state but must label that no real visual analysis occurs without a configured provider.

### Editing

- `EDIT-001`: MVP supports name, palette substitution, 90-degree rotation, mirror X/Z and vertical placement offset.
- `EDIT-002`: Palette changes recompile locally/server-side without another AI charge.
- `EDIT-003`: Every saved change creates an immutable structure version.
- `EDIT-004`: Full voxel editing and freehand painting are post-MVP.

### Preview

- `VIEW-001`: Orbit, pan, zoom, reset camera, auto-rotate and fullscreen.
- `VIEW-002`: Grid, axis indicator, bounding box and ground plane toggles.
- `VIEW-003`: Hover/selection shows coordinate and block identifier.
- `VIEW-004`: Stats show dimensions, total blocks and material breakdown.
- `VIEW-005`: Special blocks may use proxy geometry but must be labelled as simplified.
- `VIEW-006`: Preview remains interactive at 5,000 blocks on a mid-range laptop and does not allocate one React component per block.

### Export

- `EXP-001`: Download a UTF-8 Java Edition `.mcfunction` file with LF line endings.
- `EXP-002`: Commands use relative coordinates and an explicitly selected origin convention.
- `EXP-003`: Exporter uses `/fill` for validated solid cuboids/runs and `/setblock` otherwise.
- `EXP-004`: Export metadata header includes product, structure id, game version and block count but no email or private prompt.
- `EXP-005`: Filename is ASCII-safe, lowercase and collision-resistant.
- `EXP-006`: Download page provides a version-specific datapack installation guide.
- `EXP-007`: Export result is regenerated from stored BuildSpec, never trusted client data.

### Accounts/projects

- `ACC-001`: Magic-link and Google login. Password auth is optional, not required for MVP.
- `ACC-002`: Users can list, rename, duplicate, archive and permanently delete their projects.
- `ACC-003`: Projects default to private. Public visibility requires explicit opt-in.
- `ACC-004`: Account export and deletion requests are supported.
- `ACC-005`: A user sees only owned private data; authorization is enforced by database RLS and server checks.

### Gallery/community

- `GAL-001`: Public gallery is viewable without login and supports newest, featured and most remixed.
- `GAL-002`: Each public build has an indexable canonical page and social preview image.
- `GAL-003`: Remix creates a new private project linked to the source and never mutates it.
- `GAL-004`: Likes require login; downloads do not.
- `GAL-005`: Public submission enters `pending`, `approved`, `rejected` or `hidden` moderation state.
- `GAL-006`: Users can report IP, sexual, hateful, violent, personal-data or other unsafe content.
- `GAL-007`: Moderators can inspect prompt, preview, history and reports and must provide a reason for actions.

### Quotas/payments

- `BILL-001`: Immutable credit ledger; balance is the sum of ledger entries, not a mutable counter.
- `BILL-002`: Reserve one credit at job creation, capture on success, release/refund on system failure.
- `BILL-003`: Free quota is server-calculated per account and abuse signals, not only IP.
- `BILL-004`: No unlimited plan. Feature-flag credit packs and subscriptions after validation.
- `BILL-005`: Payment webhook processing is idempotent and stores provider event ids.

## 4. UX states that must exist

Empty, login-required, quota-exhausted, queued, running, repair-in-progress, succeeded-with-warnings, failed-and-refunded, moderation-pending, rejected, deleted, WebGL-unavailable and offline/retry states. No blank spinner may last longer than ten seconds without stage text.

## 5. Non-functional requirements

- Availability target: 99.5% monthly for MVP.
- p95 ordinary API latency under 500 ms, excluding generation and export.
- p95 successful generation under 35 seconds; hard stop at 60 seconds.
- First preview render under 1.5 seconds for 5,000 blocks after data arrives on reference hardware.
- WCAG 2.2 AA for non-canvas UI; preview controls must have keyboard alternatives.
- All timestamps UTC; UI localizes them.
- English first, German-ready message catalog; no hard-coded product copy in components.
- Structured logs without prompt/email by default; sensitive fields redacted.
- Daily database backups and tested restore procedure before public launch.

## 6. Analytics events

`landing_viewed`, `demo_interacted`, `prompt_started`, `generation_requested`, `generation_succeeded`, `generation_failed`, `preview_interacted`, `palette_changed`, `export_downloaded`, `gallery_viewed`, `build_remixed`, `public_submitted`, `signup_completed`, `paywall_viewed`, `checkout_started`, `purchase_completed`.

Every event has anonymous/session id, user id when available, timestamp, experiment id and non-sensitive properties. Never send the raw prompt to general analytics.
