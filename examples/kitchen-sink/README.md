# @aero-js/example-kitchen-sink

Full demo template for the Aero static site generator. Used for development and feature testing. Demonstrates pages, layouts, components, content collections, Nitro API routes, and client scripts (Alpine, HTMX).

## Structure

| Path                   | Description                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `frontend/`            | Front-end source: pages, components, layouts, assets.                                                                                                              |
| `frontend/pages/`      | Route pages (e.g. `home.html` → `/`, `demos/images.html` → `/demos/images`, `docs/[slug].html` → `/docs/:slug`).                                                   |
| `frontend/components/` | Reusable components (`-component` suffix in markup).                                                                                                               |
| `frontend/layouts/`    | Layout wrappers with `<slot>`.                                                                                                                                     |
| `frontend/assets/`     | Styles, scripts, images.                                                                                                                                           |
| `content/`             | Content collections: Markdown + frontmatter, and global data modules (`site.ts`, `theme.ts`) exposed as globals.                                                   |
| `backend/`             | Nitro: `api/`, `routes/`, `backend/plugins/`, `backend/tasks/`, and `backend/entry.ts` (wired via `nitro.config.ts`).                                              |
| `public/`              | Static assets copied as-is.                                                                                                                                        |
| `aero.config.ts`       | Aero config (content, server, dirs).                                                                                                                               |
| `nitro.config.ts`      | Canonical Nitro config for storage, cache, database, tasks, plugins, and route rules.                                                                              |
| `content.config.ts`    | Content collections (used when `content: true`).                                                                                                                   |
| `vite.config.ts`       | Build entry: `createViteConfig(aeroConfig, { command, mode })`.                                                                                                    |
| `tsconfig.json`        | Path aliases: `@components/*`, `@layouts/*`, `@pages/*`, `@content/*`, etc.                                                                                        |
| `env.d.ts`             | Optional: extends `ImportMetaEnv` with `SITE` and custom env vars for TypeScript. See [Environment variables](../../docs/_archive/data/environment-variables.mdx). |

## Commands

From `examples/kitchen-sink` (run `vp run build:all` once from repo root if workspace packages are stale):

| Command | Notes |
| --- | --- |
| `vp dev --open` | Dev server with HMR and Nitro from `nitro.config.ts` |
| `vp build` | Production build (Nitro + `dist/` when `server: true`) |
| `vp build --mode ci` | CI profile — [`.env.ci`](./.env.ci): incremental, static-only |
| `vp build --mode debug` | [`.env.debug`](./.env.debug): incremental + debug logs |
| `vp build --mode static && vp preview` | Static preview (no Nitro APIs) — [`.env.static`](./.env.static) |
| `vp build && node .output/server/index.mjs` | Full Nitro server preview |

**Fallow / static analysis** — [`.fallowrc.json`](./.fallowrc.json); regenerate entries with `aero graph --format fallow-entry` ([fallow-aero.md](../../_reference/guides/fallow-aero.md)).

## Dependencies

- `@aero-js/core/config`, `@aero-js/content`, `@aero-js/core` (workspace)
- Optional: Alpine.js, HTMX (included in this starter)

## Path aliases (tsconfig)

- `@components/*` → client/components/\*
- `@layouts/*` → client/layouts/\*
- `@pages/*` → client/pages/\*
- `@content/*` → content/\*
- `@styles/*` → client/assets/styles/\*
- `@scripts/*` → client/assets/scripts/\*
- `@images/*` → client/assets/images/\*
- `@client/*` → client/\*
- `@server/*` → server/\*
- `~/*` → project root
