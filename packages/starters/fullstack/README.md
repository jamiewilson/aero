# @aero-js/starter-fullstack

Full-stack Aero template with Nitro enabled from day one. Includes `nitro.config.ts`, API routes, Nitro cache/storage/database examples, a task, a plugin, and a `preview:api` command.

## Structure

- `client/` — Pages, layouts, components, assets
- `content/site.ts` — Global site data
- `server/` — Nitro API/routes plus server plugins, tasks, and server entry
- `server/plugins/` — Nitro runtime hooks
- `server/tasks/` — Nitro task handlers
- `server/entry.ts` — Nitro server entry (wired via `serverEntry`)
- `nitro.config.ts` — Canonical Nitro config for the project

## Commands

- `pnpm dev` — Vite dev server with Nitro
- `pnpm build` — Build static HTML and Nitro output
- `pnpm preview` — Preview the static build only
- `pnpm preview:api` — Preview the full Nitro server from `.output/`

## Learn More

- [Nitro in Aero guide](https://github.com/jamiewilson/aero/blob/main/docs/nitro-overview.md)
