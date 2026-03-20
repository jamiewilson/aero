---
published: true
title: Routing
subtitle: How Aero's file-based routing works for static and dynamic pages.
---

Aero uses file-based routing. HTML files inside `client/pages/` (or your configured pages directory) map directly to URL paths. There is no router config — the file system is the router.

## Static pages

Every `.html` file in the pages directory becomes a route. Examples:

- `client/pages/index.html` — `/` → `dist/index.html`
- `client/pages/about.html` → `/about` outputs to `dist/about/index.html`
- `client/pages/404.html` → 404 page outputs to `dist/404.html`
- `client/pages/docs/index.html` → `/docs` outputs `dist/docs/index.html`

```sh
.
└── pages
		└── docs
				├── index.html → /docs
				└── intro.html → /docs/intro

2 directories, 2 files
```

**Root and index:** `index.html` at the root of the pages directory maps to `/`. Other filenames (e.g. `home.html`) map to their name (`/home`). If both `index.html` and `home.html` exist in the same directory, `index.html` is `/` and `home.html` is `/home`.

**Nested directories:** Subdirectories map to URL segments. An `index.html` inside a directory is that segment’s root:

**Error pages:** `client/pages/404.html` is the error page, rendered to `dist/404.html`. With Nitro preview, unmatched URLs are served this page with a 404 status.

## Dynamic routes

Pages with bracket-delimited filenames create dynamic routes. The bracket content is the parameter name, available as `Aero.page.params.<name>`.

- `client/pages/[id].html` → `/:id` (e.g. `/alpha`, `/beta`)
- `client/pages/docs/[slug].html` → `/docs/:slug` (e.g. `/docs/intro`, `/docs/name`)

**Dev mode:** During `pnpm dev{:bash}`, dynamic routes are resolved at request time. Visiting `/alpha` matches `[id].html` and sets `Aero.page.params.id = 'alpha'{:ts}`. Any segment matches; no upfront list needed.

**Build mode:** For static builds (`pnpm build{:bash}`), dynamic pages must export `getStaticPaths(){:ts}` from their `<script is:build>{:html}` block so the build knows which paths to generate.

**Trailing slash:** The Nitro catch-all redirects bare paths like `/docs` to `/docs/` so relative links (e.g. `./name`) resolve to `/docs/name` correctly.

<!-- client/pages/[id].html -->

```html
<script is:build>
	import base from '@layouts/base'

	export function getStaticPaths() {
		return [{ params: { id: 'alpha' } }, { params: { id: 'beta' } }, { params: { id: 'gamma' } }]
	}
</script>

<base-layout title="Page: { Aero.page.params.id }">
	<h1>{Aero.page.params.id}</h1>
</base-layout>
```

This produces `dist/alpha/index.html`, `dist/beta/index.html`, and `dist/gamma/index.html`.

**Nested dynamic:** Same idea in subdirectories — e.g. `client/pages/docs/[slug].html` with `getStaticPaths(){:ts}` returning `{ params: { slug: 'intro' } }{:ts}` and similar produces `dist/docs/intro/index.html`, etc.

**Async paths:** `getStaticPaths(){:ts}` can be `async` so you can load paths from an API, CMS, or filesystem at build time.

**Missing getStaticPaths:** If a dynamic page does not export `getStaticPaths(){:ts}`, it is skipped at build with a warning. The page still works in dev but does not emit static files.

## Template context

Inside `<script is:build>{:html}` and in template expressions you have:

**`Aero.page.params`** — Dynamic route parameters (e.g. `{ id: 'alpha' }{:ts}`).

**`Aero.page.url`** — Full URL object for the current page.

**`Aero.page.url.pathname`** — The path (e.g. `'/alpha'`).

**`Aero.props`** — Props from a parent component or layout (e.g. `{ title: 'Hello' }{:ts}`).

## Linking between pages

Use normal `<a href>{:html}` with relative paths:

```html
<a href="/">Home</a>
<a href="/about">About</a>
<a href="/docs/intro">Intro</a>
```

The build rewrites absolute `href` values to relative paths so the site works from any base path.

## Modes and behaviour

**`pnpm run dev{:bash}`**

Pages are rendered on request; dynamic routes resolved at request time; unknown routes show "Page not found"; API routes (`/api/*`) are handled by Nitro when enabled; links stay absolute.

**`pnpm run preview{:bash}`**

Pages are pre-rendered to `dist/`; dynamic routes are expanded via `getStaticPaths(){:ts}`; unknown routes mean no file (404); no API; links in HTML are rewritten to relative.

**`pnpm run preview:api{:bash}`**

Same static output is served; Nitro also serves `dist/404.html` for unknown routes and handles `/api/*`; links are relative.

## File structure reference

```sh
.
└── pages
    ├── 404.html        → (error page)
    ├── about.html      → /about
    ├── docs
    │   ├── [slug].html → /docs/:slug (with `getStaticPaths`)
    │   └── index.html  → /docs
    └── home.html       → / (root page)

2 directories, 5 files
```
