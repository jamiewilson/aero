dist/ ← vite build (static-only deployment target)

# Aero

Aero is a static site generator and full-stack framework with a custom HTML-first template engine.

This repo is a monorepo:

- **packages/core** – Framework (compiler, runtime, Vite plugin)
- **packages/vite** – Vite plugin re-export
- **packages/vscode** – VS Code extension (syntax, completion, diagnostics)
- **packages/start** – Starter app (pages, components, config, server)

From the repo root:

- `pnpm dev` builds core, then runs the starter app.
- To work only on the starter: `pnpm --dir packages/start dev` (after building core once: `pnpm --dir packages/core build`).

## Getting Started

- Install dependencies: `pnpm install`
- Develop with unified origin (pages + API): `pnpm dev` (from root)
- Build output: `pnpm build`
- Static output is always in `dist/` (e.g., `dist/index.html`, `dist/about/index.html`, `dist/docs/index.html`)
- With `aero({ nitro: true })`, `pnpm build` also emits Nitro output in `.output/`
- All links/assets are relative for static hosting (openable via `file://`)
- Preview static output: `pnpm preview` or `pnpm preview:static`
- Preview API runtime (static + API): `pnpm preview:api`

## Unified API + Site Preview

- API handlers: [packages/start/server/api](packages/start/server/api)
- Build + preview with unified origin: `pnpm preview:api`
- The catch-all route [packages/start/server/routes/[...].ts](packages/start/server/routes/[...].ts) serves `dist/` from the Nitro server, so pages and API endpoints run from the same origin.

## Build and Output Structure

- `pnpm build` always runs `vite build` (static output in `dist/`)
- If `aero({ nitro: true })` is enabled, also runs `nitro build` (output in `.output/`)
- `pnpm preview` / `pnpm preview:static` force static-only build before preview
- `pnpm preview:api` runs the Nitro server for local API + static preview

### Output Directories

```
dist/                          ← vite build (static-only deployment)
├── index.html
├── about/index.html
├── assets/scripts/
├── assets/styles/
├── favicon.svg, robots.txt
└── .vite/manifest.json

.output/                       ← nitro build (server deployment)
├── public/                    ← static assets for CDN layer
└── server/                    ← self-contained server
		├── index.mjs
		├── chunks/routes/
		├── chunks/nitro/
		├── favicon.svg, robots.txt
		└── .vite/manifest.json
```

### Which Output to Deploy

| Mode                  | Command            | Deploy            | Serves static files via                                  | API  |
| --------------------- | ------------------ | ----------------- | -------------------------------------------------------- | ---- |
| **Static only**       | `pnpm build`       | `dist/`           | CDN, S3, GitHub Pages, or `file://`                      | None |
| **Server + CDN**      | `pnpm build`       | `.output/`        | CDN serves `.output/public/`, server handles `/api/*`    | Yes  |
| **Server standalone** | `pnpm build`       | `.output/server/` | Server serves everything (static + API) from one process | Yes  |
| **Preview (local)**   | `pnpm preview:api` | —                 | Nitro catch-all route serves from `dist/`                | Yes  |

**Note:** You only deploy one output per deployment mode.

## Aero Plugin Options

In `vite.config.ts`, the `aero()` plugin supports:

- `nitro` (boolean): Enable Nitro integration (default: false)
- `apiPrefix` (string): URL prefix for API routes (default: `/api`)
- `dirs`:
  - `src` (default `src`) — pages, components, layouts, content
  - `server` (default `server`) — API handlers and routes
  - `dist` (default `dist`) — static output directory

**Example:**

```ts
import { aero } from '@aero-ssg/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: aero({ nitro: true }),
})
```

**Custom structure:**

```ts
export default defineConfig({
	plugins: aero({
		nitro: true,
		dirs: {
			src: 'web',
			server: 'api',
			dist: 'build',
		},
		apiPrefix: '/backend',
	}),
})
```

When using `preview:api` with custom `dist` or `apiPrefix`, set env vars: `AERO_DIST`, `AERO_API_PREFIX`.

### `dirs.server` and `nitro.config.ts`

`dirs.server` is passed to Nitro as `serverDir`. In `nitro.config.ts`, set `scanDirs` to match. For example, if you set `dirs.server: 'api'`, also set `scanDirs: ['api']` in `nitro.config.ts`.

```ts

```
