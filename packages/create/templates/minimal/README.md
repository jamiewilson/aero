# Aero minimal starter

Static Aero template: one layout, index + about, `site.ts` only. No server, no content collections, no Alpine/HTMX.

## Create a project

```bash
vp create @aero-js:minimal --directory my-app --no-interactive
cd my-app && pnpm install
```

## Structure

- `client/` — Pages, layouts, components, assets
- `content/site.ts` — Global site data
- `public/` — Static assets
- No `server/` — static-only

## Commands

- `pnpm dev` — Vite+ dev server (`vp dev`)
- `pnpm build` — Static build to `dist/`
- `pnpm preview` — Preview the built site
