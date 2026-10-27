# Aero minimal starter

Static Aero template: one layout, index + about, `site.ts` only. No server, no content collections, no Alpine/HTMX.

## Create a project

```bash
vp create @aero-js:minimal --directory my-app --no-interactive
cd my-app && pnpm install
```

## Structure

| Path              | Description                        |
| ----------------- | ---------------------------------- |
| `client/`         | Pages, layouts, components, assets |
| `content/site.ts` | Global site data                   |
| `public/`         | Static assets copied as-is         |
| `vite.config.ts`  | Vite+ entry with `aero()` plugin   |

No `server/` — static-only. No root `aero.config.ts`; options live on the `aero()` plugin in `vite.config.ts`.

## Path aliases (tsconfig)

- `@pages/*` → `client/pages/*`
- `@layouts/*` → `client/layouts/*`
- `@components/*` → `client/components/*`
- `@styles/*` → `client/assets/styles/*`
- `@scripts/*` → `client/assets/scripts/*`
- `@images/*` → `client/assets/images/*`
- `@content/*` → `content/*`

## Commands

Install [Vite+](https://viteplus.dev/guide/) (`vp`) once, then from the project directory after `pnpm install`:

- `vp dev` — Dev server with HMR
- `vp build` — Production build to `dist/`
- `vp preview` — Serve the production build locally (after `vp build`)
- `pnpm fmt` — Format JS/TS and Aero HTML
