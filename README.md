# TBD

## Static build and dev

- Install deps: `pnpm install`.
- Develop the static site with Vite: `pnpm dev` (serves pages from app/\* without Nitro).
- Build static assets: `pnpm build` → outputs to dist/ for any static host.
- Preview the static output: `pnpm preview`.

## Optional API server (Nitro or other)

- API handlers live in [server/api](server/api) (example: [server/api/submit.post.ts](server/api/submit.post.ts)).
- Run Nitro for APIs only: `pnpm dev:api` (default port 3000). Keep Vite running separately for the front-end.
- During dev, proxy `/api` from Vite to Nitro by setting `TBD_API_PROXY=http://localhost:3000` before `pnpm dev`.
- For production, deploy the static `dist/` output to a static host and run `pnpm build:api` + `pnpm preview:api` to package/verify the API server separately.
- The catch-all HTML route in [server/routes/[...].ts](server/routes/[...].ts) is only used when you choose to run Nitro alongside the static build.

## Opt-in Nitro integration via Vite

- Nitro is no longer part of the default Vite pipeline. To include the Nitro plugin (e.g., if you want Vite to orchestrate a Nitro build), set `WITH_NITRO=true` for the Vite command you run.
