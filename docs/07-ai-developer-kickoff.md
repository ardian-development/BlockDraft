# AI developer kickoff

## Instruction to give the coding agent

Use the following as the initial task. Do not ask it to build the entire SaaS in one pass.

```text
You are implementing BlockDraft from the repository specifications. Read README.md and all files under docs/ and specs/ before editing. Start only with Delivery Phase 1: repository/CI, shared domain package, JSON Schema + Zod parity, deterministic compiler primitives, versioned safe block registry, Java mcfunction baseline exporter and tests. Do not implement auth, Supabase, AI calls, payments or production UI yet.

Requirements:
- Use pnpm workspaces and TypeScript strict mode.
- Keep compiler/exporter pure and independent of frameworks and providers.
- Treat specs/build-spec.schema.json as the external contract. Add semantic validation for operation-specific requirements not fully expressible there.
- Implement box and carve_box first, then one primitive per commit/change set.
- Enforce all bounds before and after expansion.
- Canonical output sorts Y, then Z, then X and has a stable SHA-256 hash.
- Add unit, boundary, determinism and malicious-input tests.
- The exporter accepts only canonical validated structures and one explicit Java version registry.
- Document every assumption about Minecraft command syntax and mark it for in-game integration verification.
- Run lint, typecheck and tests before handoff. Report changed files, commands run, results and remaining Phase 1 risks.
```

## First implementation milestone

Expected deliverables:

```text
package.json
pnpm-workspace.yaml
turbo.json
tsconfig.base.json
packages/domain/
packages/build-dsl/
packages/block-registry/
packages/exporters/
fixtures/build-spec/
fixtures/golden/
.github/workflows/ci.yml
```

Minimum public APIs:

```ts
type ValidationResult<T> =
  | { ok: true; value: T; warnings: DomainWarning[] }
  | { ok: false; errors: DomainError[] };

function validateBuildSpec(input: unknown): ValidationResult<BuildSpecV1>;
function compileBuildSpec(spec: BuildSpecV1, registry: BlockRegistry): CanonicalStructure;
function transformStructure(input: CanonicalStructure, transform: StructureTransform): CanonicalStructure;
function exportMcfunction(input: CanonicalStructure, adapter: JavaVersionAdapter): ExportArtifact[];
```

Canonical placement:

```ts
type BlockPlacement = Readonly<{
  x: number;
  y: number;
  z: number;
  blockId: `minecraft:${string}`;
  states?: Readonly<Record<string, string>>;
  sourceOperationId: string;
}>;
```

`CanonicalStructure` contains immutable placements, tight dimensions, material histogram, warnings, schema/compiler/registry versions and content hash. The content hash excludes timestamps, display name and operation diagnostics so equivalent placed structures hash identically.

## Mandatory review questions after each phase

1. Which requirements and IDs were completed?
2. Which assumptions were made that the specification did not settle?
3. Which security boundaries changed?
4. What is the worst input tested?
5. What can cause a user to lose a credit or project?
6. What new recurring cost was introduced?
7. How is the change rolled back?

## Prohibited shortcuts

- Do not use AI output directly as Minecraft commands.
- Do not store a mutable credit balance without the ledger.
- Do not expose a Supabase service-role key to browser code.
- Do not make projects public automatically.
- Do not create one mesh or React component per voxel.
- Do not silently truncate a generated structure; fail or return an explicit warning before capture.
- Do not add a second game version until the first has executable golden tests.
- Do not copy competitor source, visual assets, page copy, prompts or user data.

## Human checks the AI developer cannot replace

- Verify export commands inside the exact supported Minecraft Java version.
- Review the product/brand name and legal notices.
- Verify payment-provider terms before enabling checkout.
- Review privacy treatment for minors and international users.
- Visually score the 100-prompt evaluation set.
- Approve public moderation policy and escalation contacts.

## Architecture completion checklist

- [ ] Compiler and exporter are deterministic and independently versioned.
- [ ] AI provider can be replaced without changing domain packages.
- [ ] Every privileged database path has RLS/server authorization tests.
- [ ] Job/credit transaction is idempotent under retries.
- [ ] Viewer meets draw-call, frame-rate and disposal targets.
- [ ] Costs, latency and model versions are observable per generation.
- [ ] Failed system jobs automatically refund reservations.
- [ ] Public gallery exposes a safe projection only.
- [ ] Account deletion/export works end to end.
- [ ] Restore, incident and spend-cap procedures have been exercised.
