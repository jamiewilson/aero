# @aero-js/example-kitchen-sink

Full demo template for the Aero static site generator. Used for development and feature testing. Demonstrates pages, layouts, components, content collections, Nitro API routes, and client scripts (Alpine, HTMX).

## Structure

| Path                 | Description                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client/`            | Client source: pages, components, layouts, assets, and client-only types.                                                                                       |
| `client/pages/`      | Route pages (e.g. `home.html` → `/`, `demos/images.html` → `/demos/images`, `docs/[slug].html` → `/docs/:slug`).                                                 |
| `client/components/` | Reusable components (`-component` suffix in markup).                                                                                                             |
| `client/layouts/`    | Layout wrappers with `<slot>`.                                                                                                                                   |
| `client/assets/`     | Styles, scripts, images.                                                                                                                                         |
| `content/`           | Content collections: Markdown + frontmatter, and global data modules (`site.ts`, etc.) exposed as globals.                                                       |
| `server/`            | Nitro: `server/api/`, `server/routes/`, `server/tasks/`, and `server/entry.ts` (wired via `nitro.config.ts`).                                                  |
| `shared/`            | Code shared by client and server (types, Shiki theme helpers, small utilities).                                                                                  |
| `public/`              | Static assets copied as-is.                                                                                                                                        |
| `aero.config.ts`       | Aero config (`content`, `server`, reactivity, hypermedia, site URL, redirects).                                                                                    |
| `nitro.config.ts`      | Canonical Nitro config for storage, cache, database, tasks, plugins, and route rules.                                                                              |
| `content.config.ts`    | Content collections (used when `content: true`).                                                                                                                   |
| `vite.config.ts`       | Build entry: `createViteConfig(aeroConfig, { command, mode })`.                                                                                                    |
| `tsconfig.json`        | Path aliases: `@components/*`, `@layouts/*`, `@pages/*`, `@content/*`, etc.                                                                                        |
| `env.d.ts`             | Optional: extends `ImportMetaEnv` with `SITE` and custom env vars for TypeScript. See [Environment variables](../../docs/_archive/data/environment-variables.mdx). |

## Commands

From `examples/kitchen-sink` (run `vp run build:all` once from repo root if workspace packages are stale):

| Command                                     | Notes                                                           |
| ------------------------------------------- | --------------------------------------------------------------- |
| `vp dev --open`                             | Dev server with HMR and Nitro from `nitro.config.ts`            |
| `vp build`                                  | Production build (Nitro + `dist/` when `server: true`)          |
| `vp build --mode ci`                        | CI profile — [`.env.ci`](./.env.ci): incremental, static-only   |
| `vp build --mode debug`                     | [`.env.debug`](./.env.debug): incremental + debug logs          |
| `vp build --mode static`                    | Static-only build — [`.env.static`](./.env.static)              |
| `vp preview`                                | Serve the production build locally (after static or `--mode static` build) |
| `pnpx nitro preview`                        | Full app preview — static + API from `.output/` (after `vp build`) |
| `node .output/server/index.mjs`             | Production Node server entry (after `vp build`; deploy parity)  |

**Fallow / static analysis** — [`.fallowrc.json`](./.fallowrc.json); regenerate entries with `aero graph --format fallow-entry` ([fallow-aero.md](../../_reference/guides/fallow-aero.md)).

## Dependencies

- `@aero-js/core/config`, `@aero-js/content`, `@aero-js/core` (workspace)
- Optional: Alpine.js, HTMX (included in this starter)

## Path aliases (tsconfig)

- `@client/*` → client/\*
- `@pages/*` → client/pages/\*
- `@layouts/*` → client/layouts/\*
- `@components/*` → client/components/\*
- `@styles/*` → client/assets/styles/\*
- `@scripts/*` → client/assets/scripts/\*
- `@images/*` → client/assets/images/\*
- `@content/*` → content/\*
- `@shared/*` → shared/\*
