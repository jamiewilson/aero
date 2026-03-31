# Aero Monorepo and Packages Reference

This document describes the current monorepo layout and how the Aero framework package relates to the app and templates.

## Layout Overview

```
aero/
├── package.json           # Workspace root; build script builds packages only
├── pnpm-workspace.yaml
├── packages/
│   ├── compiler/          # Standalone template compiler (@aero-js/compiler)
│   ├── core/             # Framework: codegen, runtime, Vite plugin (@aero-js/core; Vite plugin via @aero-js/vite)
│   ├── vscode/           # VS Code extension
│   ├── create/            # Project initializer (@aero-js/create)
│   ├── starters/
│   │   ├── minimal/       # Static starter template (@aero-js/starter-minimal)
│   │   └── fullstack/     # Nitro starter template (@aero-js/starter-fullstack)
├── examples/
│   └── kitchen-sink/      # Full demo app (@aero-js/example-kitchen-sink)
│       ├── frontend/      # Or client/; pages, components, layouts, assets (per aero.config dirs)
│       ├── backend/       # Or server/; Nitro API and routes
│       ├── content/       # Global data, content collections
│       ├── build/         # Or dist/; output when custom dirs used
│       ├── vite.config.ts
│       ├── .aero/         # Generated Nitro config/runtime files when server: true
│       └── nitro.config.ts# Optional canonical Nitro config for end-user features
├── docs/
└── .github/
```

## packages/compiler (@aero-js/compiler)

- **Purpose:** Standalone HTML template compiler. Can be used independently of the Aero framework.
- **Build:** `tsdown` builds from source into `packages/compiler/dist/`.
- **Consumption:** `@aero-js/core` depends on this package; the compiler is extracted for reuse.
- **Exports:**
  - `@aero-js/compiler` → main entry: `parse()`, `compile()`
  - `@aero-js/compiler/parser` → `parse()` only
  - `@aero-js/compiler/codegen` → `compile()` only
  - `@aero-js/compiler/helpers` → `escapeHtml()`, `raw()`, `compileInterpolation()`, etc.
  - `@aero-js/compiler/types` → TypeScript types
- **Features:**
  - Auto-escaping: `{ expr }` outputs HTML-escaped text
  - Raw output: `{ raw(expr) }` bypasses escaping
  - Loop metadata: `{ item, index in items }` provides `index`, `first`, `last`, `length`

## packages/core (framework)

- **Purpose:** Template parser, codegen, runtime, and Vite plugin used by the app.
- **Build:** `tsup` builds from source into `packages/core/dist/`. Root scripts run `pnpm --dir packages/core build` so the app always uses the built package.
- **Consumption:** `examples/kitchen-sink/vite.config.ts` imports `createViteConfig` from `@aero-js/config/vite` and depends on `@aero-js/core`. The `package.json` has `"@aero-js/core": "workspace:*"` (and config, content).
- **Exports (package.json):**
  - `@aero-js/core` → main entry and types
  - `@aero-js/vite` → Vite plugin (re-exports from core)
  - `@aero-js/core/runtime`, `@aero-js/core/runtime/instance` → runtime
  - `@aero-js/core/types` → TypeScript types
- **Key directories:**
  - `codegen/` — Aero-specific codegen that wraps @aero-js/compiler; tests in `codegen/__tests__/`
  - `vite/` — plugin entry, build orchestration, defaults; tests in `vite/__tests__/`
  - `runtime/` — Aero class, instance context, client entry
  - `utils/` — aliases (tsconfig path loading), routing

## packages/vscode

- **Purpose:** VS Code extension for Aero (e.g. syntax highlighting for Aero expressions).
- **Contents:** `package.json`, `syntaxes/aero-expressions.json`, README. Separate from the core framework; not required for build or dev.

## packages/create (@aero-js/create)

- **Purpose:** Project initializer. Run `pnpm create @aero-js <name>` to scaffold a new app into `packages/create/dist/<name>` (monorepo; dist is gitignored) or into the current directory when published. Depends on the starter packages under `packages/starters/`.
- **No app source** in create; starters live in `packages/starters/` and are copied from node_modules.

## examples/kitchen-sink (demo app)

- **Purpose:** Full demo app. Run dev/build/preview from **examples/kitchen-sink** (e.g. `pnpm --dir examples/kitchen-sink dev`). Root has no app dev script.
- **Source directory:** Configurable via aero.config; kitchen-sink uses `frontend/`, `backend/`, `build/` for output. Default layout would be `client/`, `content/`, `server/`. Global data at `content/` (e.g. `site.ts`, content collections).
- **Path aliases:** Defined in `examples/kitchen-sink/tsconfig.json`; the Aero resolver merges these with framework defaults when resolving component/layout imports in HTML.
- **Server:** When `server: true`, Aero generates `.aero/nitro.config.mjs` and extends the app's root `nitro.config.ts` when present. API stays in backend/ (or server/), routes in backend/routes.

## packages/starters/minimal

- **Purpose:** Minimal starter template (one layout, index + about, `site.ts` only; no server, no content collections). Used by `pnpm create @aero-js <name>` by default.
- **Structure:** `client/`, `content/site.ts`, `public/`; no `server/`, no `content.config.ts`.

## packages/starters/fullstack

- **Purpose:** Nitro-enabled starter template. Includes root `nitro.config.ts`, `server/` routes, `plugins/`, `tasks/`, and `preview:api`.
- **Structure:** `client/`, `content/site.ts`, `server/`, `plugins/`, `tasks/`, `server.ts`, `nitro.config.ts`.

## Build and test flow

1. **Install:** `pnpm install` (pnpm workspace installs root + packages).
2. **Build framework:** Root `pnpm build` builds packages (interpolation, highlight, core, content, config, vite) in order.
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

- **Framework code** lives in `packages/core` (compiler, runtime, Vite plugin). `packages/vite` re-exports the plugin as `@aero-js/vite`; core also exports it as `@aero-js/core/vite`.
- **Demo app** is `examples/kitchen-sink`; run dev/build/preview from that directory. Root has no app dev script.
- **@aero-js/create** lives in `packages/create`; scaffolds from `packages/starters/minimal`.
- **Path conventions** use `client/` and `content/` by default (or custom dirs via aero.config, e.g. frontend/, backend/).
