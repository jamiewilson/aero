# TBD Monorepo and Packages Reference

This document describes the current monorepo layout and how the TBD framework package relates to the app.

## Layout Overview

```
tbd-start/
├── packages/
│   ├── tbd/              # Framework: compiler, runtime, Vite plugin
│   └── tbd-vscode/        # VS Code extension (syntaxes)
├── src/                   # App source (default “app” directory)
│   ├── pages/
│   ├── components/
│   ├── layouts/
│   ├── content/           # Global data (site.ts → `site` in templates)
│   └── assets/
├── server/                # Nitro API and routes
├── public/
├── vite.config.ts         # Uses tbd/vite plugin
├── nitro.config.ts
├── tsconfig.json          # Path aliases for app
└── package.json           # Workspace root; devDependencies: tbd (workspace:*)
```

## packages/tbd (framework)

- **Purpose:** Template parser, codegen, runtime, and Vite plugin used by the app.
- **Build:** `tsup` builds from source into `packages/tbd/dist/`. Root scripts `predev`, `prebuild`, `prepreview`, `prepreview:api` run `pnpm --dir packages/tbd build` so the app always uses the built package.
- **Consumption:** Root `vite.config.ts` does `import { tbd } from 'tbd/vite'` and uses `tbd({ nitro: true })`. The app’s `package.json` has `"tbd": "workspace:*"` in devDependencies.
- **Exports (package.json):**
  - `tbd` → main entry and types
  - `tbd/vite` → Vite plugin
  - `tbd/runtime`, `tbd/runtime/instance` → runtime
  - `tbd/types` → TypeScript types
- **Key directories:**
  - `compiler/` — parser, codegen, resolver, constants, helpers; tests in `compiler/__tests__/`
  - `vite/` — plugin entry, build orchestration, defaults; tests in `vite/__tests__/`
  - `runtime/` — TBD class, instance context, client entry
  - `utils/` — aliases (tsconfig path loading), routing

## packages/tbd-vscode

- **Purpose:** VS Code extension for TBD (e.g. syntax highlighting for TBD expressions).
- **Contents:** `package.json`, `syntaxes/tbd-expressions.json`, README. Separate from the core framework; not required for build or dev.

## App (root)

- **Source directory:** By default `src/` (configurable via `tbd({ dirs: { src: '…' } })`). Pages live at `<src>/pages`, components at `<src>/components`, layouts at `<src>/layouts`, global data at `<src>/content`.
- **Path aliases:** Defined in root `tsconfig.json` (e.g. `@components/*` → `./src/components/*`, `@content/*` → `./src/content/*`). The TBD resolver uses these when resolving component/layout imports in HTML.
- **Server:** `server/api/` and `server/routes/` are used by Nitro; `nitro.config.ts` has `scanDirs: ['server']`.

## Build and test flow

1. **Install:** `pnpm install` (pnpm workspace installs root + packages).
2. **Build framework:** `pnpm --dir packages/tbd build` (or run via predev/prebuild from root).
3. **Dev:** `pnpm dev` runs Vite with the TBD plugin; Nitro is enabled when `tbd({ nitro: true })`.
4. **Build app:** `pnpm build` runs Vite build (output to `dist/`) and, with Nitro, also produces `.output/`.
5. **Tests:** `pnpm test` runs Vitest inside `packages/tbd` (compiler and vite tests). Run from repo root.

## Summary

- **Framework code** lives in `packages/tbd` (compiler, runtime, Vite plugin).
- **App code** lives at the repo root under `src/` and `server/`.
- **Path conventions** in docs and config use `src/` (not `client/` or `app/`), and `src/content/` for global data (not a top-level `data/` directory).
- **Cursor rules and AGENTS.md** reference `packages/tbd` paths for the pipeline and `src/` for the app.
