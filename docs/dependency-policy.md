# Dependency policy

How the Aero monorepo pins and shares dependency versions so builds stay reproducible and upgrades stay intentional.

## pnpm catalog

Shared versions for framework development live in the root [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) under `catalog:`. Packages reference them with the `catalog:` protocol in `package.json` (for example `"vite": "catalog:"`).

Prefer **catalog** entries for tooling that should move together across packages (TypeScript, Vite, Vitest, tsdown, Nitro, etc.).

## Root overrides

The root [`package.json`](../package.json) may define `pnpm.overrides` for security fixes or to align a transitive dependency with a known-good version. Treat overrides as **explicit exceptions**—document why in the commit or a short comment when non-obvious.

## Explicit versions

When a package needs a version **different** from the catalog (e.g. a single package requires a newer patch), use an explicit semver range in that package’s `package.json` and prefer a short note in the PR if the reason is not obvious.

## CI and guardrails

- **`pnpm install`** with a locked lockfile is the source of truth for CI.
- Keep `packageManager` in root `package.json` aligned with the pnpm version contributors should use.

For product-level principles that include “stay aligned with Vite / modern JS tooling,” see [_reference/aero-principles-and-goals.md](../_reference/aero-principles-and-goals.md).
