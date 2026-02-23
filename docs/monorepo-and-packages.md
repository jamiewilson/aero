# Aero Monorepo and Packages Reference

This document describes the current monorepo layout and how the Aero framework package relates to the app.

## Layout Overview

```
aero-start/
├── package.json           # Workspace root; scripts delegate to packages
├── pnpm-workspace.yaml
├── packages/
│   ├── core/              # Framework: compiler, runtime, Vite plugin (@aero-ssg/core)
│   ├── vite/              # Vite plugin re-export (@aero-ssg/vite)
│   ├── vscode/            # VS Code extension (syntaxes)
│   └── start/             # Starter/scaffold app (@aero-ssg/start)
│       ├── package.json
│       ├── vite.config.ts
│       ├── nitro.config.ts
│       ├── tsconfig.json
│       ├── src/            # Pages, components, layouts, content, assets
│       ├── server/         # Nitro API and routes
│       └── public/
├── docs/
├── .cursor/
└── .github/
```

## packages/core (framework)

- **Purpose:** Template parser, codegen, runtime, and Vite plugin used by the app.
- **Build:** `tsup` builds from source into `packages/core/dist/`. Root scripts `predev`, `prebuild`, `prepreview`, `prepreview:api` run `pnpm --dir packages/core build` so the app always uses the built package.
- **Consumption:** `packages/start/vite.config.ts` does `import { aero } from '@aero-ssg/vite'` and uses `aero({ nitro: true })` (optional `site: 'https://...'` for canonical URL; see [site-url.md](site-url.md)). The app’s `package.json` has `"@aero-ssg/vite": "workspace:*"` in its devDependencies.
- **Exports (package.json):**
  - `@aero-ssg/core` → main entry and types
  - `@aero-ssg/core/vite` → Vite plugin (also re-exported as `@aero-ssg/vite`)
  - `@aero-ssg/core/runtime`, `@aero-ssg/core/runtime/instance` → runtime
  - `@aero-ssg/core/types` → TypeScript types
- **Key directories:**
  - `compiler/` — parser, codegen, resolver, constants, helpers; tests in `compiler/__tests__/`
  - `vite/` — plugin entry, build orchestration, defaults; tests in `vite/__tests__/`
  - `runtime/` — Aero class, instance context, client entry
  - `utils/` — aliases (tsconfig path loading), routing

## packages/vscode

- **Purpose:** VS Code extension for Aero (e.g. syntax highlighting for Aero expressions).
- **Contents:** `package.json`, `syntaxes/aero-expressions.json`, README. Separate from the core framework; not required for build or dev.

## packages/start (starter app)

- **Purpose:** Scaffold/starter project. The app that root scripts run (e.g. `pnpm dev` → runs start's dev server).
- **Source directory:** `packages/start/src/` (configurable via `aero({ dirs: { src: '…' } })`). Pages at `src/pages/`, components at `src/components/`, layouts at `src/layouts/`, global data at `src/content/`.
- **Path aliases:** Defined in `packages/start/tsconfig.json` (e.g. `@components/*` → `./src/components/*`). The Aero resolver uses these when resolving component/layout imports in HTML.
- **Server:** `packages/start/server/api/` and `packages/start/server/routes/`; `packages/start/nitro.config.ts` has `scanDirs: ['server']`.

## Build and test flow

1. **Install:** `pnpm install` (pnpm workspace installs root + packages).
2. **Build framework:** `pnpm --dir packages/core build` (or run via predev/prebuild from root).
3. **Dev:** `pnpm dev` (from root) builds core then runs `packages/start` dev server (Vite + Aero plugin; Nitro when `aero({ nitro: true })`).
4. **Build app:** `pnpm build` builds core then runs start's build (output to `packages/start/dist/` and `packages/start/.output/`).
5. **Tests:** `pnpm test` runs Vitest inside `packages/core` (compiler and vite tests). Run from repo root.

## Summary

- **Framework code** lives in `packages/core` (compiler, runtime, Vite plugin).
- **Starter app** lives in `packages/start` (src/, server/, config). Root is a thin workspace; scripts delegate to core and start.
- **Path conventions** use `src/` and `src/content/` for global data within the start package.
- **Cursor rules and AGENTS.md** reference `packages/core` for the pipeline and `packages/start` for the app.
