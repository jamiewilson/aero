# @aero-ssg/template-minimal

Minimal Aero template: one layout, index + about, `site.ts` only. No server, no content collections, no Alpine/HTMX. Use with `pnpm create aero my-app` (default) or `pnpm create aero my-app --template minimal`.

## Structure

- `client/` — Pages, layouts, components, assets
- `content/site.ts` — Global site data
- `public/` — Static assets
- No `server/` — static-only

## Commands

From the scaffolded project (after `pnpm create aero my-app`):

- `pnpm dev` — Vite dev server
- `pnpm build` — Static build to `dist/`
- `pnpm preview` — Preview built site
