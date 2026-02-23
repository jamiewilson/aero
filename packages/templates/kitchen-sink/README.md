# @aero-ssg/template-kitchen-sink

Full demo template for the Aero static site generator. Used for development and feature testing. Demonstrates pages, layouts, components, content collections, Nitro API routes, and client scripts (Alpine, HTMX).

## Structure

| Path | Description |
|------|-------------|
| `client/` | Front-end source: pages, components, layouts, assets. |
| `client/pages/` | Route pages (e.g. `home.html` → `/`, `about.html` → `/about`, `docs/[slug].html` → `/docs/:slug`). |
| `client/components/` | Reusable components (`-component` suffix in markup). |
| `client/layouts/` | Layout wrappers with `<slot>`. |
| `client/assets/` | Styles, scripts, images. |
| `content/` | Content collections: Markdown + frontmatter, and global data modules (`site.ts`, `theme.ts`) exposed as globals. |
| `server/` | Nitro: `api/` (e.g. `submit.post.ts`), `routes/` (e.g. catch-all for static). |
| `public/` | Static assets copied as-is. |
| `aero.config.ts` | Aero config (content, server, dirs, vite). |
| `content.config.ts` | Content collections (used when `content: true`). |
| `vite.config.ts` | Build entry: `createViteConfig(aeroConfig, { command, mode })`. |
| `tsconfig.json` | Path aliases: `@components/*`, `@layouts/*`, `@pages/*`, `@content/*`, etc. |
| `env.d.ts` | Optional: extends `ImportMetaEnv` with `SITE` and custom env vars for TypeScript. See docs/environment-variables.md. |

## Commands

From repo root (or from `packages/start` if core is built):

- **pnpm dev** — Vite dev server with HMR (and Nitro when `server: true`).
- **pnpm build** — Static build to `dist/`; with Nitro also produces `.output/`.
- **pnpm preview** — Static preview only (`AERO_NITRO=false` build + `vite preview`).
- **pnpm preview:api** — Full server preview (static + Nitro API).

Ensure `packages/core` is built before dev/build (`pnpm run dev` at root runs core build first).

## Dependencies

- `@aero-ssg/config`, `@aero-ssg/content`, `@aero-ssg/core` (workspace)
- Optional: Alpine.js, HTMX (included in this starter)

## Path aliases (tsconfig)

- `@components/*` → client/components/*
- `@layouts/*` → client/layouts/*
- `@pages/*` → client/pages/*
- `@content/*` → content/*
- `@styles/*` → client/assets/styles/*
- `@scripts/*` → client/assets/scripts/*
- `@images/*` → client/assets/images/*
- `@src/*` → client/*
- `@server/*` → server/*
- `~/*` → project root
