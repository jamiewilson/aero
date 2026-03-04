# Aero Monorepo and Packages Reference

This document describes the current monorepo layout and how the Aero framework package relates to the app and templates.

## Layout Overview

```
aero/
├── package.json           # Workspace root; build script builds packages only
├── pnpm-workspace.yaml
├── packages/
│   ├── core/              # Framework: compiler, runtime, Vite plugin (@aerobuilt/core; Vite plugin via aerobuilt/vite)
│   ├── vscode/            # VS Code extension
│   ├── create-aerobuilt/  # Project initializer (create-aerobuilt)
│   ├── templates/
│   │   └── minimal/       # Starter template (@aerobuilt/template-minimal)
├── examples/
│   └── kitchen-sink/      # Full demo app (@aerobuilt/example-kitchen-sink)
│       ├── frontend/      # Or client/; pages, components, layouts, assets (per aero.config dirs)
│       ├── backend/       # Or server/; Nitro API and routes
│       ├── content/       # Global data, content collections
│       ├── build/         # Or dist/; output when custom dirs used
│       ├── vite.config.ts
│       └── .aero/         # Generated Nitro config when server: true (no top-level nitro.config)
├── docs/
└── .github/
```

## packages/core (framework)

- **Purpose:** Template parser, codegen, runtime, and Vite plugin used by the app.
- **Build:** `tsup` builds from source into `packages/core/dist/`. Root scripts run `pnpm --dir packages/core build` so the app always uses the built package.
- **Consumption:** `examples/kitchen-sink/vite.config.ts` (and templates/minimal) use `import { createViteConfig } from 'aerobuilt/config'` and depend on `@aerobuilt/core`. The `package.json` has `"@aerobuilt/core": "workspace:*"` (and config, content).
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

## packages/create-aerobuilt (create-aerobuilt)

- **Purpose:** Project initializer. Run from `packages/create-aerobuilt`: `pnpm run create-aerobuilt <name>` to scaffold a new app into `packages/create-aerobuilt/dist/<name>` (monorepo; dist is gitignored) or into the current directory when published. Depends on `@aerobuilt/template-minimal`.
- **No app source** in create-aerobuilt; templates live in `packages/templates/` and are copied from node_modules.

## examples/kitchen-sink (demo app)

- **Purpose:** Full demo app. Run dev/build/preview from **examples/kitchen-sink** (e.g. `pnpm --dir examples/kitchen-sink dev`). Root has no app dev script.
- **Source directory:** Configurable via aero.config; kitchen-sink uses `frontend/`, `backend/`, `build/` for output. Default layout would be `client/`, `content/`, `server/`. Global data at `content/` (e.g. `site.ts`, content collections).
- **Path aliases:** Defined in `examples/kitchen-sink/tsconfig.json`; the Aero resolver merges these with framework defaults when resolving component/layout imports in HTML.
- **Server:** When `server: true`, Nitro config is generated under `.aero/`; API in backend/ (or server/), routes in backend/routes.

## packages/templates/minimal

- **Purpose:** Minimal starter template (one layout, index + about, `site.ts` only; no server, no content collections). Used by `pnpm run create-aerobuilt <name>` by default.
- **Structure:** `client/`, `content/site.ts`, `public/`; no `server/`, no `content.config.ts`.

## Build and test flow

1. **Install:** `pnpm install` (pnpm workspace installs root + packages).
2. **Build framework:** Root `pnpm build` builds packages (interpolation, highlight, core, content, config, aerobuilt) in order.
3. **Dev:** Run from **examples/kitchen-sink** (e.g. `pnpm --dir examples/kitchen-sink dev` or `cd examples/kitchen-sink && pnpm dev`). Root has no dev script.
4. **Build app:** Run from the app directory (e.g. `pnpm --dir examples/kitchen-sink build`). Output to that app's dist/ (or custom build dir) and `.output/` when server is enabled.
5. **Tests:** `pnpm test` from repo root runs Vitest (packages/core compiler and vite tests).

## Build output and asset layout

The static build writes a flat, predictable output for deployment and caching.

- **`dist/`** — Result of `pnpm build` (Vite + Aero plugin). Pre-rendered HTML and built assets.
- **`.output/`** — When Nitro is enabled (`aero({ server: true })`). Contains static output and Nitro server. Deploy this when you need API routes.

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

- **Framework code** lives in `packages/core` (compiler, runtime, Vite plugin). No separate packages/vite; Vite plugin is in core and consumed as `aerobuilt/vite` or `@aerobuilt/core/vite`.
- **Demo app** is `examples/kitchen-sink`; run dev/build/preview from that directory. Root has no app dev script.
- **create-aerobuilt** lives in `packages/create-aerobuilt`; scaffolds from `packages/templates/minimal`.
- **Path conventions** use `client/` and `content/` by default (or custom dirs via aero.config, e.g. frontend/, backend/).
