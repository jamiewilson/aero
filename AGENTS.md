# Aero Project Instructions (Pi Agents)

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

If instructions conflict, follow: system/developer instructions > this file > task-specific rule files.

## 6) Documentation discipline

- Put durable user-facing behavior in `docs/` and README.
- Record notable discovered gaps/tech debt in `_reference/DISCOVERY.md` when appropriate.
- Keep plans/progress docs focused (do not mix roadmap logs into discovery notes).

## 7) Practical defaults for edits

- Prefer existing patterns over inventing new abstractions.
- Preserve public APIs unless change is intentional and justified.
- Add/update tests with each functional change.
- Keep generated artifacts deterministic and avoid duplicated sources of truth.
