# System architecture

## 1. Context

```text
Browser
  | HTTPS/JWT
  v
Next.js web + API -------- Payment provider (later)
  |       |                         |
  |       +---- webhook ------------+
  |
  +---- Supabase Auth/Postgres/Storage
  |
  +---- generation job queue ---- Worker ---- AI provider
                                      |
                                      +---- validator/compiler/exporter
```

Keep the compiler, validator and exporters as pure packages. They must not import Next.js, Supabase or an AI SDK. This makes generated structures reproducible, testable and portable.

## 2. Components

### Web application

Server-render public landing/gallery pages for SEO. Authenticated dashboard and generator are client-enhanced. Route handlers authenticate, validate inputs, call domain services and return stable API errors. The browser may read public/owned records through Supabase only where RLS is explicitly tested; privileged writes go through the API.

### Generation service

`POST /v1/generations` performs authentication, rate limit, quota reservation and job creation in one transaction. A worker claims jobs using `FOR UPDATE SKIP LOCKED`, marks a lease, calls the provider, validates, optionally repairs, compiles, persists artifacts and settles the ledger. Reclaim expired leases. Only one active job per free user.

For the first private alpha the same domain service may run synchronously behind the API. The job table and state machine are still mandatory so moving to a worker requires no API change.

Job states:

```text
queued -> running -> validating -> compiling -> succeeded
                  \-> repairing --/
queued/running/... -> failed | cancelled
```

State transitions use a compare-and-set update and append an audit event. Terminal states cannot be reopened.

### AI adapter

Interface:

```ts
interface StructurePlanner {
  plan(input: PlannerInput, signal: AbortSignal): Promise<PlannerResult>;
  repair(input: RepairInput, signal: AbortSignal): Promise<PlannerResult>;
}
```

The provider adapter handles SDK calls and usage reporting. The domain layer supplies a JSON schema and receives unknown JSON. No API key or provider response is sent to the browser.

### Compiler

Input: validated BuildSpec. Output: canonical sorted block list, dimensions, histogram, warnings and SHA-256 content hash. Operations are expanded into integer voxel coordinates. Collision policy is last-operation-wins, except `air` may only be used by explicit carve operations. The final list sorts by Y, then Z, then X for deterministic export.

### Block registry

Versioned records map logical palette tokens to Minecraft ids, supported block states, preview color/texture, transparency and proxy geometry. Registry versions are immutable after release. MVP allowlist excludes command blocks, structure blocks, signs with text, containers with NBT, fluids, fire, portals and entities.

### Artifact storage

Postgres stores metadata and compact BuildSpec JSON. Object storage stores compiled block payloads, preview images and exports when caching is useful. Paths are generated server-side and private objects use short-lived signed URLs.

## 3. Deployment environments

- `local`: Supabase CLI/local Postgres, fake AI adapter, deterministic fixtures.
- `preview`: isolated database branch/project, sandbox payments, strict low quotas.
- `production`: separate secrets, backups, alerts and domain.

Never share service-role keys across environments. All schema changes are migrations committed to Git. Production migrations run before application rollout only when backward compatible; destructive changes use expand/migrate/contract.

## 4. Architectural decisions

- Modular monolith, not microservices. One web deploy and one worker are enough.
- Postgres is the system of record. Analytics is not a source of truth.
- BuildSpec is canonical; rendered blocks and exports are derived artifacts.
- Async job API is canonical even if alpha executes synchronously.
- Public-by-default is forbidden; new projects are private.
- Model providers are replaceable and measured by successful-build cost, not token price alone.
- Do not add Redis initially. Postgres handles jobs, locks, quotas and idempotency.
- Do not persist chain-of-thought. Store only user input, normalized plan/result, errors and usage metadata needed for the product.

