# @aero-js/starter-fullstack

Full-stack Aero template with Nitro enabled from day one. Includes `nitro.config.ts`, API routes, Nitro cache/storage/database examples, a task, a plugin, and a `preview:api` command.

## Structure

- `client/` — Pages, layouts, components, assets
- `content/site.ts` — Global site data
- `server/` — Nitro API routes and the static catch-all route
- `plugins/` — Nitro runtime hooks
- `tasks/` — Nitro task handlers
- `server.ts` — Nitro server entry
- `nitro.config.ts` — Canonical Nitro config for the project

## Commands

- `pnpm dev` — Vite dev server with Nitro
- `pnpm build` — Build static HTML and Nitro output
- `pnpm preview` — Preview the static build only
- `pnpm preview:api` — Preview the full Nitro server from `.output/`
