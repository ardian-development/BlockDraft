# Delivery plan for an AI developer

## Working rules

Implement vertical slices, commit migrations with code, keep provider calls behind fakes, and do not start with visual polish. Every ticket must include tests and acceptance evidence. Never weaken a limit or RLS policy merely to make a test pass.

## Phase 0 — validation, 1 week

- Create landing page, waitlist and three pre-rendered examples.
- Interview 10 Minecraft creators and 10 casual builders.
- Test three messages: instant architecture, editable blueprints, or build instructions.
- Exit: at least five interviewees independently describe a recent build problem and at least 20% of qualified landing visitors start the demo/waitlist.

## Phase 1 — deterministic core, weeks 1-2

- Monorepo, lint, typecheck, test and CI.
- BuildSpec schema/types.
- Compiler primitives and golden fixtures.
- Block registry for one Java version and 30-50 safe blocks.
- `.mcfunction` baseline exporter.
- Exit: all fixture hashes stable and golden exports tested manually in Minecraft.

## Phase 2 — preview, week 3

- Viewer scene, instancing, controls, stats and selection.
- Load local fixtures and handle WebGL failure.
- Memory/performance harness.
- Exit: 5,000-block fixture meets performance targets and 20 structure switches do not grow retained resources materially.

## Phase 3 — product shell, weeks 4-5

- Supabase migrations, RLS, auth, dashboard and project pages.
- Private storage and signed artifact access.
- API envelopes, validation, request ids and fake generation job.
- Exit: E2E user isolation tests prove user A cannot read user B data.

## Phase 4 — AI generation, weeks 6-7

- Planner adapter, prompt versions, structured output and repair.
- Job state machine, lease/claim worker, quota reservation/settlement.
- Cost/latency metadata and 100-prompt evaluation runner.
- Exit: >=70% first-pass and >=90% after-repair compile success on evaluation set.

## Phase 5 — gallery/moderation, week 8

- Public pages, social images, remix, likes, reports and moderation queue.
- Sitemap, canonical URLs and structured metadata.
- Exit: only approved safe projection is anonymous; rejected/private builds never leak.

## Phase 6 — private alpha, weeks 9-10

- 25-50 invited users, analytics, feedback widget and error monitoring.
- Fix top generation categories and onboarding friction.
- Do not implement payments yet.
- Exit: 60% activation, 30% successful-preview-to-download and evidence of repeat usage.

## Phase 7 — monetization experiment, weeks 11-12

- Credit ledger UI, provider checkout/webhook behind feature flag.
- Test credit pack vs subscription with real pricing page; no unlimited use.
- Exit: at least 3% of users who hit a real quota start checkout and refund/support burden is acceptable.

## First backlog, in order

1. Repository/CI and shared TypeScript config.
2. BuildSpec JSON schema and Zod parity test.
3. Compiler coordinate map and `box`/`carve_box`.
4. Remaining primitives and property tests.
5. Versioned block registry.
6. Java exporter and golden files.
7. Viewer fixture route and instancing.
8. Viewer controls, selection and performance test.
9. Database migrations and RLS tests.
10. Auth/project dashboard.
11. Generation API with fake provider.
12. Worker state machine and ledger.
13. Real provider adapter and evaluation suite.
14. Download/installation guide.
15. Gallery/remix/moderation.
16. Analytics and alpha operations.

## Definition of done per ticket

- Acceptance criteria demonstrably pass.
- Tests cover success, boundary and unauthorized/failure paths.
- No new TypeScript `any` without justification.
- Schema/API behavior documented.
- Logs contain request/job ids and no sensitive raw content.
- Keyboard and mobile layout checked for ordinary UI.
- Feature flag and rollback exist for provider/payment changes.

## Zero-budget discipline

- Use free tiers and local fakes until private alpha.
- Put a hard daily spend cap and per-user limit around real AI calls.
- Seed the gallery with independently created fixtures, not copied builds.
- Prefer simple colors over licensed texture packs initially.
- Avoid paid ads, subscriptions infrastructure and multiple game versions before retention.
- Publish no broad launch until abuse controls and cost telemetry work.

