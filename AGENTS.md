# Aero Project Instructions

Use this file as the default instruction set for all work in this repo.

## 1) Product guardrails (non-negotiable)

- Aero is **HTML-first**: prefer plain `.html`, CSS, JS/TS with a thin compile-time layer.
- Aero is **static-first**: generate static HTML by default.
- Nitro is **optional and thin**: do not turn Aero into a parallel server framework.
- Prefer web-platform behavior and progressive enhancement over mandatory runtime complexity.
- Keep framework-managed contracts type-safe where Aero can model them.

Primary references:

- `README.md`
- `_reference/guides/aero-principles-and-goals.md`
- `.agents/rules/aero-principles-and-goals.mdc`

## 2) Engineering priorities

When tradeoffs conflict, prioritize:

1. Correctness
2. Clarity
3. Simplicity
4. Safety
5. Performance
6. Generality

General principles:

- Separation of concerns
- Explicit over implicit
- Fail fast, fail loudly
- Parse/validate at boundaries; keep internals on known-good data
- Dependencies flow inward (core logic should not depend on outer layers)
- Remove duplicated knowledge (avoid semantic drift)

Reference: `.agents/rules/aero-coding-principles.mdc`

## 3) Monorepo boundaries

- `packages/compiler`: shared template compiler/parsing/analysis
- `packages/core`: runtime + Vite integration + Aero orchestration
- `packages/diagnostics`: diagnostic contracts/formatting
- `packages/cli`: `aero check`, `aero doctor`
- `packages/create`, `packages/templates`, `packages/vscode`
- `examples/kitchen-sink`: app used for dev/build validation

Do not introduce coupling that breaks package boundaries.

Reference: `.agents/rules/aero-architecture.mdc`

## 4) Required workflow for code changes

For behavior changes and bug fixes, use TDD cadence:

- Red: add/adjust a failing test
- Green: minimal fix
- Refactor: improve while keeping tests green

Before finishing, run relevant checks (targeted first):

- tests (Vitest)
- typecheck/lint when touched scope requires it

Use smallest safe change set; avoid unrelated refactors.

## 5) Task-specific rule routing

Read these before domain-specific edits:

- Templates (`*.html`): `.agents/rules/aero-templates.mdc`
- Compiler/core internals: `.agents/rules/aero-compiler.mdc`
- Nitro/server handlers: `.agents/rules/aero-server.mdc`
- User-facing docs (`README`, `docs/**`, site docs): `.agents/rules/aero-user-docs.mdc`
- TypeScript doc comments: `.agents/rules/aero-tsdoc.mdc`
- Compile ↔ IDE diagnostics parity: `_reference/guides/diagnostics/parity-matrix.md` (also summarized in `_reference/architecture/diagnostics-surfaces.md`)
- Error pipeline (normalize → enrich → render): `_reference/guides/diagnostics/error-pipeline.md`
- Engineering knowledge map: `_reference/README.md` (ADR / FDR / architecture)

If instructions conflict, follow: system/developer instructions > this file > task-specific rule files.

## 6) Documentation discipline

- Put durable **user-facing** behavior in `docs/` and README.
- Put durable **engineering** knowledge in `_reference/` — start at [`_reference/README.md`](_reference/README.md):
  - Cross-cutting decisions → [`_reference/adr/`](_reference/adr/INDEX.md)
  - Feature behaviour → [`_reference/fdr/`](_reference/fdr/INDEX.md)
  - Current system shape → [`_reference/architecture/`](_reference/architecture/INDEX.md)
  - Implementation sequencing → [`_reference/plans/`](_reference/plans/INDEX.md) (`deferred/`, `archive/`; lifecycle: [`_reference/guides/plan-management.md`](_reference/guides/plan-management.md))
  - Research → [`_reference/exploration/`](_reference/exploration/INDEX.md)
  - Status / order / checklist → [`_reference/plans/sequence-guidance.md`](_reference/plans/sequence-guidance.md), [`_reference/plans/order-of-work.md`](_reference/plans/order-of-work.md), [`_reference/plans/work-checklist.md`](_reference/plans/work-checklist.md)
- Record opportunistic gaps/tech debt in [`_reference/DISCOVERY.md`](_reference/DISCOVERY.md) only (not full specs).
- Prefer [glossary](_reference/GLOSSARY.md) terms when naming new concepts.

## 7) Practical defaults for edits

- Prefer existing patterns over inventing new abstractions.
- Preserve public APIs unless change is intentional and justified.
- Add/update tests with each functional change.
- Keep generated artifacts deterministic and avoid duplicated sources of truth.

## 8) GitButler in Codex

This repo is already registered with GitButler. If `but status -fv` reports
`Setup required: unable to open database file`, treat that as a Codex sandbox
permission issue, not a missing GitButler setup.

GitButler stores its repo database under `.git/gitbutler/`, so Codex needs write
access to `/Users/jamie/dev/aero/.git/gitbutler` for `but status` and mutation
commands. In restricted sessions, rerun `but` commands with elevated filesystem
access rather than repeatedly running `but setup`.
