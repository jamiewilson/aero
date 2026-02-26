# Aero Monorepo and Packages Reference

This document describes the current monorepo layout and how the Aero framework package relates to the app and templates.

## Layout Overview

```
aero/
├── package.json           # Workspace root; scripts delegate to packages
├── pnpm-workspace.yaml
├── packages/
│   ├── core/              # Framework: compiler, runtime, Vite plugin (@aerobuilt/core)
│   ├── vite/              # Vite plugin re-export (@aerobuilt/vite)
│   ├── vscode/            # VS Code extension (syntaxes)
│   ├── start/             # Project initializer (create-aero); dist/ for scaffolded apps
│   ├── templates/
│   │   ├── kitchen-sink/  # Full demo app (@aerobuilt/template-kitchen-sink); root dev/build runs this
│   │   │   ├── client/    # Pages, components, layouts, assets
│   │   │   ├── content/   # Global data, content collections
│   │   │   ├── server/    # Nitro API and routes
│   │   │   ├── public/
│   │   │   ├── vite.config.ts
│   │   │   └── nitro.config.ts
│   │   └── minimal/       # Minimal template (@aerobuilt/template-minimal)
├── docs/
├── .cursor/
└── .github/
```

## packages/core (framework)

- **Purpose:** Template parser, codegen, runtime, and Vite plugin used by the app.
- **Build:** `tsup` builds from source into `packages/core/dist/`. Root scripts run `pnpm --dir packages/core build` so the app always uses the built package.
- **Consumption:** `packages/templates/kitchen-sink/vite.config.ts` (and minimal) use `import { createViteConfig } from 'aerobuilt/config'` and depend on `@aerobuilt/core`. The template `package.json` has `"@aerobuilt/core": "workspace:*"` (and config, content).
- **Exports (package.json):**
  - `@aerobuilt/core` → main entry and types
  - `aerobuilt/vite` → Vite plugin (also re-exported as `@aerobuilt/vite`)
  - `@aerobuilt/core/runtime`, `@aerobuilt/core/runtime/instance` → runtime
  - `@aerobuilt/core/types` → TypeScript types
- **Key directories:**
  - `compiler/` — parser, codegen, resolver, constants, helpers; tests in `compiler/__tests__/`
  - `vite/` — plugin entry, build orchestration, defaults; tests in `vite/__tests__/`
  - `runtime/` — Aero class, instance context, client entry
  - `utils/` — aliases (tsconfig path loading), routing

## packages/vscode

- **Purpose:** VS Code extension for Aero (e.g. syntax highlighting for Aero expressions).
- **Contents:** `package.json`, `syntaxes/aero-expressions.json`, README. Separate from the core framework; not required for build or dev.

## packages/create-aero (create-aero)

- **Purpose:** Project initializer. Run from `packages/create-aero`: `pnpm run create-aero <name>` to scaffold a new app into `packages/create-aero/dist/<name>` (monorepo; dist is gitignored) or into the current directory when published. Depends on `@aerobuilt/template-minimal` and `@aerobuilt/template-kitchen-sink`.
- **No app source** in start; templates live in `packages/templates/` and are copied from node_modules.

## packages/templates/kitchen-sink (app used for dev/build)

- **Purpose:** Full demo app. Root `pnpm dev`, `pnpm build`, `pnpm preview` run this package.
- **Source directory:** `client/` (pages at `client/pages/`, components at `client/components/`, layouts at `client/layouts/`, assets at `client/assets/`). Global data at `content/` (e.g. `site.ts`, content collections).
- **Path aliases:** Defined in `packages/templates/kitchen-sink/tsconfig.json` (e.g. `@components/*` → `./client/components/*`). The Aero resolver uses these when resolving component/layout imports in HTML.
- **Server:** `server/api/`, `server/routes/`; `nitro.config.ts` has `scanDirs: ['server']`.

## packages/templates/minimal

- **Purpose:** Minimal template (one layout, index + about, `site.ts` only; no server, no content collections). Used by `pnpm run create-aero <name>` by default.
- **Structure:** Same as kitchen-sink but stripped: `client/`, `content/site.ts`, `public/`; no `server/`, no `content.config.ts`.

## Build and test flow

1. **Install:** `pnpm install` (pnpm workspace installs root + packages).
2. **Build framework:** `pnpm --dir packages/core build` (or run via predev/prebuild from root).
3. **Dev:** `pnpm dev` (from root) runs `packages/templates/kitchen-sink` dev server (Vite + Aero plugin; Nitro when enabled).
4. **Build app:** `pnpm build` builds core then runs kitchen-sink build (output to `packages/templates/kitchen-sink/dist/` and `.output/`).
5. **Tests:** `pnpm test` runs Vitest inside `packages/core` (compiler and vite tests). Run from repo root.

## Build output and asset layout

The static build writes a flat, predictable output for deployment and caching.

- **`dist/`** — Result of `pnpm build` (Vite + Aero plugin). Pre-rendered HTML and built assets.
- **`.output/`** — When Nitro is enabled (`aero({ nitro: true })`). Contains `public/` (static) and `server/` (Nitro). Deploy this when you need API routes.

Static assets (CSS, JS, images) go under **`dist/assets/`** with hashed filenames. No deep nested paths:

```
dist/
├── index.html
├── about/index.html
├── 404.html
├── sitemap.xml          (when site is set)
└── assets/
    ├── global-[hash].css
    ├── index-[hash].js
    └── about-[hash].jpg
```

Links in built HTML are rewritten to be relative so the site works from any base path (CDN or `file://`).

## Summary

- **Framework code** lives in `packages/core` (compiler, runtime, Vite plugin).
- **App used for dev/build** is `packages/templates/kitchen-sink` (client/, content/, server/, config). Root scripts delegate to kitchen-sink.
- **create-aero** lives in `packages/create-aero`; scaffolds from `packages/templates/minimal` or `packages/templates/kitchen-sink`.
- **Path conventions** use `client/` and `content/` in templates (not `src/`).
