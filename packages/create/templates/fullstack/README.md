# Aero fullstack starter

Aero with Nitro: `server/` API routes, KV/cache/database demos, and static HTML from `client/`.

## Create a project

```bash
vp create @aero-js:fullstack --directory my-app --no-interactive
cd my-app && pnpm install
```

## Commands

| Command            | Description                            |
| ------------------ | -------------------------------------- |
| `pnpm dev`         | Dev server with Nitro                  |
| `vp build`         | Static HTML + Nitro output             |
| `vp build --mode static && vp preview` | Static preview (see `.env.static`) |
| `pnpm preview:api` | Run built Nitro server from `.output/` |

## Structure

See template `server/`, `nitro.config.ts`, and [Aero server docs](https://github.com/jamiewilson/aero/tree/main/docs/getting-started).
