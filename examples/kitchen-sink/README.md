# @aero-js/example-kitchen-sink

Full demo template for the Aero static site generator. Used for development and feature testing. Demonstrates pages, layouts, components, content collections, Nitro API routes, and client scripts (Alpine, HTMX).

## Structure

| Path                   | Description                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `frontend/`            | Front-end source: pages, components, layouts, assets.                                                                       |
| `frontend/pages/`      | Route pages (e.g. `home.html` → `/`, `about.html` → `/about`, `docs/[slug].html` → `/docs/:slug`).                          |
| `frontend/components/` | Reusable components (`-component` suffix in markup).                                                                        |
| `frontend/layouts/`    | Layout wrappers with `<slot>`.                                                                                              |
| `frontend/assets/`     | Styles, scripts, images.                                                                                                    |
| `content/`             | Content collections: Markdown + frontmatter, and global data modules (`site.ts`, `theme.ts`) exposed as globals.            |
| `backend/`             | Nitro: `api/`, `routes/`, `backend/plugins/`, `backend/tasks/`, and `backend/entry.ts` (wired via `nitro.config.ts`).       |
| `public/`              | Static assets copied as-is.                                                                                                 |
| `aero.config.ts`       | Aero config (content, server, dirs, vite).                                                                                  |
| `nitro.config.ts`      | Canonical Nitro config for storage, cache, database, tasks, plugins, and route rules.                                       |
| `content.config.ts`    | Content collections (used when `content: true`).                                                                            |
| `vite.config.ts`       | Build entry: `createViteConfig(aeroConfig, { command, mode })`.                                                             |
| `tsconfig.json`        | Path aliases: `@components/*`, `@layouts/*`, `@pages/*`, `@content/*`, etc.                                                 |
| `env.d.ts`             | Optional: extends `ImportMetaEnv` with `SITE` and custom env vars for TypeScript. See docs/drafts/environment-variables.md. |

## Commands

From repo root (or from `examples/kitchen-sink` if core is built):

- **pnpm dev** — Vite dev server with HMR and Nitro loaded from `nitro.config.ts`.
- **pnpm build** — Static build to `dist/`; with Nitro also produces `.output/`.
- **pnpm preview** — Static preview only (`AERO_SERVER=false` build + `vite preview`).
- **pnpm preview:api** — Full server preview (static + Nitro API).
- **Fallow / static analysis** — This example includes [`.fallowrc.json`](./.fallowrc.json). Regenerate the `entry` list with `aero graph --format fallow-entry` (see [\_reference/fallow-aero.md](../../_reference/guides/fallow-aero.md)).

Ensure `packages/core` is built before dev/build (`pnpm run dev` at root runs core build first).

## Dependencies

- `@aero-js/config`, `@aero-js/content`, `@aero-js/core` (workspace)
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
