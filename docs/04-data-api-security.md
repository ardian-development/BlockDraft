# Data model, API and security

## 1. Core tables

All ids UUID, timestamps `timestamptz`, soft deletion only where recovery is a product requirement. Generated JSON uses `jsonb` with an application schema version.

- `profiles`: `id=auth.user`, display name, locale, role, created_at.
- `projects`: owner_id, name, prompt, visibility, current_version_id, archived_at.
- `structure_versions`: project_id, ordinal, build_spec, schema_version, compiler_version, content_hash, dimensions, block_count, material_histogram, artifact paths.
- `generation_jobs`: owner_id, project_id, status, lease, input, provider metadata, usage/cost, error code, timestamps.
- `credit_ledger`: user_id, signed amount, reason, reference type/id, idempotency key.
- `quota_usage`: user_id, quota date/window, count; unique per rule/window.
- `gallery_entries`: project/version, moderation state, slug, title, description, featured_at, published_at.
- `reactions`: user_id, gallery_entry_id, type; unique tuple.
- `reports`: reporter, entry, category, details, status.
- `moderation_events`: moderator, target, action, reason, metadata.
- `prompt_templates`: key, version, locale, content hash, active flag.
- `payment_events`: provider event id unique, type, payload hash, processed_at, result.
- `audit_events`: actor, action, target, safe metadata, timestamp.

Indexes: owner/date project lists; job status/lease; gallery state/published; unique slug; report status; ledger user/date; unique content hash where appropriate. Keep payment raw payload encrypted or in restricted storage only if required for dispute handling.

## 2. RLS rules

- Anonymous: approved gallery projections only, never raw projects/build prompts.
- Authenticated: own profile/projects/versions/jobs/ledger reads.
- Authenticated writes: limited profile fields and project metadata through validated paths.
- Moderator: moderation views/actions through server role checks.
- Service role: worker and web backend only; never shipped to browser.
- Public gallery uses a security-invoker view exposing an explicit safe column list.

Every new exposed table fails CI unless RLS is enabled and policies have positive and negative tests.

## 3. HTTP API

All responses use `{data, error, requestId}`. Errors have stable codes and safe messages. Validate body, params and query with shared schemas. Use cursor pagination.

- `POST /api/v1/generations`: create project/job and reserve quota. Returns `202` and job id.
- `GET /api/v1/generations/{id}`: owner status, stages, result version id.
- `POST /api/v1/generations/{id}/cancel`: conditional cancel.
- `GET /api/v1/projects`: owned list.
- `GET/PATCH/DELETE /api/v1/projects/{id}`.
- `POST /api/v1/projects/{id}/transform`: palette/rotate/mirror and create version.
- `POST /api/v1/projects/{id}/export`: creates or returns cached signed artifact.
- `POST /api/v1/projects/{id}/submit`: public moderation submission.
- `GET /api/v1/gallery` and `GET /api/v1/gallery/{slug}`.
- `POST /api/v1/gallery/{id}/remix`, `/like`, `/report`.
- `POST /api/v1/webhooks/payment`: raw-body signature verification and idempotent processing.
- `GET /api/v1/me/usage`, `POST /api/v1/me/export`, `DELETE /api/v1/me`.

## 4. Security controls

- Rate limits by user plus privacy-preserving network/device abuse signals.
- CSRF protection for cookie-authenticated mutations; strict same-site cookies.
- CSP restricting scripts, frames, connections and image origins.
- Escape all community text; no user HTML.
- Signed storage URLs with short expiry; random non-guessable paths.
- AI output is untrusted: schema validation, numeric bounds, identifier allowlist and exporter revalidation.
- Never allow AI-created commands, NBT, URLs or filenames in MVP.
- Prompt injection cannot grant tools; the planner has no browser, database or file tools.
- Secrets only in deployment secret stores; redact logs and error tracking.
- Webhooks require signature, timestamp tolerance and unique event id.
- Admin actions require MFA-capable identity, role check and audit trail.
- Dependency and secret scanning in CI; lockfile committed.

## 5. Privacy and youth safety

Launch as a 13+ creator service unless legal review establishes a compliant younger-user flow. Collect no date of birth beyond the minimum age gate, no precise location and no public email. Projects are private by default. Publish clear retention/deletion periods, subprocessors and AI-data handling. Do not use user prompts for model training without separate explicit consent.

## 6. Testing gates

- Unit: compiler primitives, validators, quota ledger, exporter.
- Property-based: random bounded BuildSpecs never escape bounds or create invalid ids.
- Integration: database transactions, RLS, worker leases, webhook idempotency.
- Contract: provider adapter fixtures and API schemas.
- Visual: known structure screenshots at fixed camera.
- End-to-end: sign in, generate with fake provider, preview, transform, export, submit, moderate, remix.
- Minecraft acceptance: execute golden exports in a disposable world for the supported version and compare sampled blocks/bounds.
- Load: concurrent generation requests cannot double-spend credits or claim one job twice.

