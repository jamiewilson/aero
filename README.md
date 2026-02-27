# Aero

Aero (`aerobuilt` on npm) is a static site generator and full-stack framework with an HTML-first template engine. You write `.html` files with optional `<script>` and `<style>`; Aero compiles them at build time, outputs static HTML (and optionally a Nitro server), and plays nicely with [HTMX](https://htmx.org) and [Alpine.js](https://alpinejs.dev) for interactivity.

## Get Started

```bash
pnpm create aerobuilt my-app
cd my-app
pnpm dev
```

Also works with npm and yarn:

```bash
npx create-aerobuilt@latest my-app
yarn create aerobuilt my-app
```

## What problems does Aero solve?

- **Author in HTML** — No custom file format. Pages and components are HTML; expressions use `{ }` so your markup stays close to what ships to the browser.
- **Clear split between build and client** — `<script is:build>` runs only at build/request time; plain `<script>` is bundled by Vite for the browser. No confusion about where code runs.
- **Static-first, server when you need it** — Default output is a static `dist/`. Enable Nitro for API routes and optional server-side rendering while keeping the same template model.
- **Fits the “HTML over the wire” stack** — Aero doesn’t own the DOM. Use HTMX for partial updates and Alpine for lightweight client behavior without a heavy JS framework.
- **Content and config as code** — `content/` (e.g. `site.ts`) and optional content collections with `getCollection()` and lazy `render()` for markdown/docs.

## How close to the platform?

Aero's goal is to stay as close to the web platform as possible while still being useful as a build tool. Here's an honest breakdown:

_(Also see: [What Makes Aero Different?](docs/what-makes-aero-different.md) for our architectural philosophy, and [Why Not Web Components?](docs/why-not-web-components.md) for a comparison of our approaches.)_

**What stays standard:**

- **You write HTML files** — not JSX, not a custom file format. Pages, components, and layouts are `.html`.
- **CSS is just CSS** — no CSS-in-JS, no scoping magic, no preprocessor lock-in.
- **Client JS is just JS** — use Alpine, HTMX, vanilla JS, or nothing at all. Aero doesn't own the DOM.
- **Output is plain static HTML** — no hydration, no client runtime, no framework overhead.

**What Aero adds:**

- **`{ }` expressions** in HTML for build-time interpolation.
- **`<script is:build>`** and other script attributes (`is:inline`, `is:blocking`) to separate build and client code.
- **`each`**, **`if`/`else`** directives for loops and conditionals in templates.
- **Component imports** and the `-component`/`-layout` naming convention.
- **`aero.props`**, **`props`**, **`pass:data`** for passing data between templates.

The abstractions are thin, HTML-shaped, and designed to disappear at build time. The source looks like HTML, the output is HTML, and everything in between stays as close to the platform as possible.

> **Note:** All custom attributes (`props`, `each`, `if`, `else`, etc.) also accept a `data-` prefix (e.g. `data-props`, `data-each`) for strict HTML spec compliance. Both forms are equivalent; the shorthand is preferred for readability.

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

Use `each` and `if` / `else-if` / `else` (with `{ }` expressions):

```html
<ul>
	<li each="{ item in items }">{ item.name }</li>
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
| **Props**        | Pass via attributes `title="{ x }"` or `props` / `props="{ ...obj }"`. In the component, read `aero.props`.                                            |
| **Slots**        | Layouts expose `<slot>` (optionally named). Put content between opening/closing layout tags.                                                           |
| **Path aliases** | `@components/*`, `@layouts/*`, `@pages/*`, `@content/*`, `@styles/*`, `@scripts/*`, `@images/*`, `@src/*`, `@server/*`, `~/*` (see template tsconfig). |

## Tools and commands

- **create-aerobuilt** — Scaffold a new app: `pnpm create aerobuilt my-app`.
- **VS Code** — The `packages/aero-vscode` extension adds syntax and diagnostics for Aero templates.
- **Commands (from repo root)**
  - `pnpm install` then `pnpm dev` — Build core and run the example app.
  - `pnpm build` — Static build to `dist/`; with Nitro enabled, also `.output/`.
  - `pnpm preview` — Static preview.
  - `pnpm preview:api` — Preview with Nitro (static + API from one origin).
  - `pnpm test` — Run Vitest (packages/core).

## Monorepo layout

| Package                        | Role                                                                    |
| ------------------------------ | ----------------------------------------------------------------------- |
| **packages/core**              | Compiler, runtime, Vite plugin (`@aerobuilt/core`, `@aerobuilt/vite`)   |
| **packages/vite**              | Re-export of the Vite plugin                                            |
| **packages/aero-vscode**       | VS Code extension (syntax, completion, diagnostics)                     |
| **packages/create-aerobuilt**  | Project initializer (create-aerobuilt); scaffolds from minimal template |
| **packages/templates/minimal** | Minimal template (no server, no content collections)                    |
| **examples/kitchen-sink**      | Full demo app with content collections, Nitro API, Alpine.js, HTMX      |
| **packages/config**            | Shared config and redirect helpers                                      |
| **packages/content**           | Content collections and markdown rendering                              |

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

For full documentation, see the [`/docs`](/docs) directory, starting with the [Table of Contents](docs/README.md).

## Links

- **VS Code Extension:** [Aero](https://marketplace.visualstudio.com/items?itemName=aerobuilt.aero-vscode)
- **NPM Packages:**
  - [`aerobuilt`](https://www.npmjs.com/package/aerobuilt)
  - [`create-aerobuilt`](https://www.npmjs.com/package/create-aerobuilt)
  - [`@aerobuilt/core`](https://www.npmjs.com/package/@aerobuilt/core)
  - [`@aerobuilt/content`](https://www.npmjs.com/package/@aerobuilt/content)
  - [`@aerobuilt/config`](https://www.npmjs.com/package/@aerobuilt/config)
  - [`@aerobuilt/template-minimal`](https://www.npmjs.com/package/@aerobuilt/template-minimal)

## Inspiration

Aero draws inspiration from and shares ideas with the following projects:

- **[Astro](https://astro.build)** — A web framework for building content-driven websites.
- **[Vite](https://vitejs.dev)** — A fast, modern frontend tooling.
- **[Nitro](https://nitro.build)** — A server engine and deployment flexibility.
- **[HTMX](https://htmx.org)** — AJAX, CSS Transitions, WebSockets and Server Sent via html attributes.
- **[Alpine.js](https://alpinejs.dev)** — A lightweight tool for composing behavior directly in your markup.
