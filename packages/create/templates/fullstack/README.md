# Aero fullstack starter

Aero with Nitro: `server/` API routes, KV/cache/database demos, and static HTML from `client/`.

## Create a project

```bash
vp create @aero-js:fullstack --directory my-app --no-interactive
cd my-app && pnpm install
```

## Commands

Install [Vite+](https://viteplus.dev/guide/) (`vp`) once, then from the project directory after `pnpm install`:

| Command | Description |
| --- | --- |
| `vp dev` | Dev server with Nitro |
| `vp build` | Static HTML + Nitro output (`vp build --mode static` for static-only; see `.env.static`) |
| `vp preview` | Serve the production build locally after `vp build` (static-only; use with `vp build --mode static`) |
| `pnpx nitro preview` | Preview static + API from `.output/` after a full `vp build` (recommended) |
| `node .output/server/index.mjs` | Same app via the production Node entry (deploy parity; after `vp build`) |
| `pnpm fmt` | Format JS/TS and Aero HTML |

**Nitro preview:** **`pnpx nitro preview`** is the usual local check — Nitro loads build info, serves public assets and the server together, and applies preview env files. **`node .output/server/index.mjs`** runs the bundled server exactly as on a Node host; use it when debugging production startup or in scripts/CI.

## Structure

| Path | Description |
| --- | --- |
| `client/` | Pages, layouts, components, assets |
| `content/site.ts` | Global site data |
| `server/` | Nitro API routes, catch-all route, tasks, entry |
| `server/api/` | Handlers (hello, KV, cache, database, task triggers) |
| `server/routes/` | App routing (e.g. `[...].ts` for Aero pages + APIs) |
| `server/entry.ts` | Nitro server entry (`serverEntry` in `nitro.config.ts`) |
| `nitro.config.ts` | Storage, cache, database, tasks, route rules |
| `public/` | Static assets copied as-is |
| `vite.config.ts` | Vite+ entry with `aero({ server: true, site: … })` |

No root `aero.config.ts` — options live on the `aero()` plugin in `vite.config.ts`. Build profiles: [`.env.static`](./.env.static), [`.env.ci`](./.env.ci).

## Path aliases (tsconfig)

- `@pages/*` → `client/pages/*`
- `@layouts/*` → `client/layouts/*`
- `@components/*` → `client/components/*`
- `@styles/*` → `client/assets/styles/*`
- `@scripts/*` → `client/assets/scripts/*`
- `@images/*` → `client/assets/images/*`
- `@content/*` → `content/*`

See [Project structure](https://github.com/jamiewilson/aero/blob/main/docs/getting-started/structure.mdx) and [Deploy with Nitro](https://github.com/jamiewilson/aero/blob/main/docs/getting-started/deployment.mdx).
