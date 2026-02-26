# Aero

**Aero** (`aerobuilt` on npm) is a static site generator and full-stack framework with an **HTML-first template engine**. You write `.html` files with optional `<script>` and `<style>`; Aero compiles them at build time, outputs static HTML (and optionally a Nitro server), and plays nicely with [HTMX](https://htmx.org) and [Alpine.js](https://alpinejs.dev) for interactivity.

## Get Started

```bash
pnpm create aero my-app
cd my-app
pnpm dev
```

Also works with npm and yarn:

```bash
npx create-aero@latest my-app
yarn create aero my-app
```

Choose a template — **minimal** (default) for static pages only, or **kitchen-sink** for the full demo with content collections, Nitro API, Alpine.js, and HTMX:

```bash
pnpm create aero my-app --template kitchen-sink
```

## What problems does Aero solve?

- **Author in HTML** — No custom file format. Pages and components are HTML; expressions use `{ }` so your markup stays close to what ships to the browser.
- **Clear split between build and client** — `<script is:build>` runs only at build/request time; plain `<script>` is bundled by Vite for the browser. No confusion about where code runs.
- **Static-first, server when you need it** — Default output is a static `dist/`. Enable Nitro for API routes and optional server-side rendering while keeping the same template model.
- **Fits the “HTML over the wire” stack** — Aero doesn’t own the DOM. Use HTMX for partial updates and Alpine for lightweight client behavior without a heavy JS framework.
- **Content and config as code** — `content/` (e.g. `site.ts`) and optional content collections with `getCollection()` and lazy `render()` for markdown/docs.

## Quick examples

### Page (file-based routing)

`client/pages/about.html` → `/about`. Use a layout and components:

```html
<script is:build>
	import base from '@layouts/base'
	import header from '@components/header'
	import site from '@content/site'
</script>

<base-layout>
	<header-component title="{ site.title }" subtitle="{ site.tagline }" />
	<main>
		<h1>About</h1>
		<p>{ site.about }</p>
	</main>
</base-layout>
```

### Component with props

Components use a `-component` or `-layout` suffix in markup; you import the template (e.g. `header` → `header.html`):

```html
<script is:build>
	import logo from '@components/logo'
	const { title, subtitle } = aero.props
</script>

<header>
	<logo-component if="{ Aero.url.pathname === '/' }" class="logo" />
	<h1 else>{ title }</h1>
	<p class="subtitle">{ subtitle }</p>
</header>
```

### Script types

- **`<script is:build>`** — Runs at build time only. One per file. Import components, read `aero.props`, use `Aero.site`, `getCollection()`, etc.
- **`<script>` (no attribute)** — Client module: bundled by Vite, HMR in dev.
- **`<script is:inline>`** — Left in the HTML as-is; runs in the browser immediately (e.g. theme FOUC fix, analytics snippet).
- **`<script is:blocking>`** — Moved into `<head>` for blocking scripts.

### Loops and conditionals

Use `data-each` and `if` / `else-if` / `else` (with `{ }` expressions):

```html
<ul>
	<li data-each="{ item in items }">{ item.name }</li>
</ul>
<div if="{ user }">Hello, { user.name }</div>
<p else>Not logged in.</p>
```

### Content and global data

Put TypeScript/JavaScript in `content/` (e.g. `content/site.ts`). Import in build scripts as `@content/site`; use in templates. For collections, use `getCollection('name')` and optional `render()` for markdown. See [docs/content-api.md](docs/content-api.md).

## Conventions

| Convention       | Description                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Routing**      | `client/pages/index.html` → `/`, `about.html` → `/about`, `blog/[slug].html` → `/blog/:slug`. Use `getStaticPaths` for dynamic routes.                 |
| **Components**   | Import without extension: `import header from '@components/header'` → `header.html`. Use `<header-component>` (or `-layout`) in markup.                |
| **Props**        | Pass via attributes `title="{ x }"` or `data-props` / `data-props="{ ...obj }"`. In the component, read `aero.props`.                                  |
| **Slots**        | Layouts expose `<slot>` (optionally named). Put content between opening/closing layout tags.                                                           |
| **Path aliases** | `@components/*`, `@layouts/*`, `@pages/*`, `@content/*`, `@styles/*`, `@scripts/*`, `@images/*`, `@src/*`, `@server/*`, `~/*` (see template tsconfig). |

## Tools and commands

- **create-aero** — Scaffold a new app: from repo `cd packages/create-aero && pnpm run create-aero my-app` (or `--template kitchen-sink`). When published: `pnpm create aero my-app`.
- **VS Code** — The `packages/aero-vscode` extension adds syntax and diagnostics for Aero templates.
- **Commands (from repo root)**
  - `pnpm install` then `pnpm dev` — Build core and run the kitchen-sink app.
  - `pnpm build` — Static build to `dist/`; with Nitro enabled, also `.output/`.
  - `pnpm preview` — Static preview.
  - `pnpm preview:api` — Preview with Nitro (static + API from one origin).
  - `pnpm test` — Run Vitest (packages/core).

## Monorepo layout

| Package                             | Role                                                                  |
| ----------------------------------- | --------------------------------------------------------------------- |
| **packages/core**                   | Compiler, runtime, Vite plugin (`@aerobuilt/core`, `@aerobuilt/vite`) |
| **packages/vite**                   | Re-export of the Vite plugin                                          |
| **packages/aero-vscode**            | VS Code extension (syntax, completion, diagnostics)                   |
| **packages/create-aero**            | Project initializer (create-aero); scaffolds from templates           |
| **packages/templates/kitchen-sink** | Full demo app (root `pnpm dev` / `pnpm build` run this)               |
| **packages/templates/minimal**      | Minimal template (no server, no content collections)                  |
| **packages/config**                 | Shared config and redirect helpers                                    |
| **packages/content**                | Content collections and markdown rendering                            |

## Configuration

In **`vite.config.ts`**, the `aero()` plugin supports:

- **`nitro`** (boolean) — Enable Nitro (API + optional server). Default `false`.
- **`site`** (string) — Canonical site URL (e.g. `'https://example.com'`). Used for sitemap, RSS, canonical/OG tags. Exposed as `import.meta.env.SITE` and `Aero.site` in templates.
- **`redirects`** — `[{ from, to, status? }]`. Applied in dev and passed to Nitro for production (use `redirectsToRouteRules()` from `@aerobuilt/config` in `nitro.config.ts`).
- **`middleware`** — Optional request-time handlers in dev (redirects, rewrites, custom responses).
- **`dirs`** — Override `client`, `server`, `dist` (defaults: `client`, `server`, `dist`).
- **`apiPrefix`** — URL prefix for API routes (default `/api`).

You can use **`aero.config.ts`** with `defineConfig` from `@aerobuilt/config` to set `site`, `redirects`, `middleware`, `content`, `server`, etc., and the Vite plugin will pick it up.

### Example

```ts
import { aero } from 'aerobuilt/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: aero({
		nitro: true,
		site: 'https://example.com',
		redirects: [{ from: '/home', to: '/', status: 301 }],
	}),
})
```

## Build output

- **Static only:** `pnpm build` → `dist/`. Deploy to any static host or open via `file://`.
- **With Nitro:** Same build also produces `.output/` (e.g. `.output/public/` for static, `.output/server/` for the server). Deploy `.output/` for API + static from one app.

Preview: `pnpm preview` (static) or `pnpm preview:api` (Nitro serving `dist/` + API).

## Docs

- [docs/README.md](docs/README.md) — Documentation index.
- [docs/overview.md](docs/overview.md) — What Aero is and what it supports.
- [AGENTS.md](AGENTS.md) — AI/developer orientation and conventions.
- [docs/script-taxonomy.md](docs/script-taxonomy.md) — Script types and behavior.
- [docs/content-api.md](docs/content-api.md) — Content collections and `getCollection` / `render`.
- [docs/site-url.md](docs/site-url.md) — Canonical URL and sitemap.
- [docs/monorepo-and-packages.md](docs/monorepo-and-packages.md) — Package layout, build flow, and output.

## Inspiration

Aero draws inspiration from and shares ideas with the following projects:

- **[Astro](https://astro.build)** — HTML-first authoring, static-by-default, and the “script type” taxonomy (`is:build` / client scripts).
- **[Vite](https://vitejs.dev)** — Dev server, HMR, and plugin system.
- **[Nitro](https://nitro.build)** — Server engine and deployment flexibility.
- **[HTMX](https://htmx.org)** — Allows you to access modern browser features directly from HTML, rather than using javascript.
- **[Alpine.js](https://alpinejs.dev)** — A lightweight, JavaScript-free framework for building reactive user interfaces.
