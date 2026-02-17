---
title: Routing
subtitle: Learn how Aero's file-based routing system works for static and dynamic pages.
date: 2026-03-15
---

Aero uses file-based routing. HTML files inside `src/pages/` map directly to URL paths. There is no router configuration — the file system _is_ the router.

## Static Pages

Every `.html` file in `src/pages/` becomes a route:

| File                        | URL        | Build output            |
| --------------------------- | ---------- | ----------------------- |
| `src/pages/home.html`       | `/`        | `dist/index.html`       |
| `src/pages/about.html`      | `/about`   | `dist/about/index.html` |
| `src/pages/404.html`        | (404 page) | `dist/404.html`         |
| `src/pages/docs/index.html` | `/docs`    | `dist/docs/index.html`  |

### Home page

`home.html` is treated as the root index page (`/`). If both `home.html` and `index.html` exist at the same directory level, `index.html` takes precedence and `home.html` becomes `/home`.

### Nested directories

Subdirectories map to URL path segments. An `index.html` inside a directory serves as the directory's root:

```
src/pages/
  docs/
    index.html      → /docs
    getting-started.html → /docs/getting-started
```

### 404 page

`src/pages/404.html` is used as the error page. It is rendered to `dist/404.html` (not nested inside a `404/` directory). In preview mode with Nitro, unmatched URLs receive this page with a `404` status code.

## Dynamic Routes

Pages with bracket-delimited filenames create dynamic routes that match multiple URL paths. The bracket content becomes a named parameter accessible via `Aero.params`.

| File                         | Pattern       | Example URLs                |
| ---------------------------- | ------------- | --------------------------- |
| `src/pages/[id].html`        | `/:id`        | `/alpha`, `/beta`           |
| `src/pages/docs/[slug].html` | `/docs/:slug` | `/docs/intro`, `/docs/name` |

### Dev mode

During development (`pnpm dev`), dynamic routes are resolved at request time. When you visit `/alpha`, the runtime matches it against `[id].html` and sets `Aero.params.id = 'alpha'`. Any URL segment will match — no upfront enumeration needed.

### Build mode

For static builds (`pnpm build`), dynamic pages **must** export a `getStaticPaths()` function from their `<script on:build>` block. This tells the build which concrete paths to generate.

```html
<!-- src/pages/[id].html -->
<script on:build>
	import base from '@layouts/base'

	export function getStaticPaths() {
		return [
			{ params: { id: 'alpha' } },
			{ params: { id: 'beta' } },
			{ params: { id: 'gamma' } },
		]
	}
</script>

<base-layout title="Page: {Aero.params.id}">
	<h1>{Aero.params.id}</h1>
</base-layout>
```

This generates three static files:

```
dist/alpha/index.html
dist/beta/index.html
dist/gamma/index.html
```

#### Nested dynamic routes

Dynamic segments work inside subdirectories:

```html
<!-- src/pages/docs/[slug].html -->
<script on:build>
	import base from '@layouts/base'

	export function getStaticPaths() {
		return [{ params: { slug: 'intro' } }, { params: { slug: 'name' } }]
	}
</script>

<base-layout title="{Aero.params.slug}">
	<h1>{Aero.params.slug}</h1>
</base-layout>
```

Output:

```
dist/docs/intro/index.html
dist/docs/name/index.html
```

#### Async data sources

`getStaticPaths` can be `async`, so you can fetch paths from an API, CMS, or filesystem at build time:

```html
<script on:build>
	import base from '@layouts/base'

	export async function getStaticPaths() {
		const res = await fetch('https://api.example.com/posts')
		const posts = await res.json()
		return posts.map(post => ({ params: { slug: post.slug } }))
	}
</script>
```

#### Missing `getStaticPaths`

If a dynamic page does not export `getStaticPaths`, it is **skipped** during the build with a warning:

```
[aero] ⚠ Skipping [id].html — no getStaticPaths() exported. Page will not be pre-rendered.
```

The page will still work in dev mode but will not produce output files in the static build.

## Template Context

Every page has access to these routing-related values inside `<script on:build>` and template expressions:

| Value               | Description                                 | Example                      |
| ------------------- | ------------------------------------------- | ---------------------------- |
| `Aero.params`       | Dynamic route parameters                    | `{ id: 'alpha' }`            |
| `Aero.url`          | Full URL object for the current page        | `URL { pathname: '/alpha' }` |
| `Aero.url.pathname` | The URL path                                | `'/alpha'`                   |
| `Aero.props`        | Props passed from a parent component/layout | `{ title: 'Hello' }`         |

## Linking Between Pages

Use standard `<a href>` tags with absolute paths:

```html
<a href="/">Home</a>
<a href="/about">About</a>
<a href="/docs/intro">Intro</a>
```

During the build, absolute `href` values (starting with `/`) are automatically rewritten to relative paths so the site works when deployed to any base path.

## Modes & Behaviour Summary

| Behaviour             | `pnpm dev`                       | `pnpm build` + `preview`          | `pnpm build` + `preview:api`      |
| --------------------- | -------------------------------- | --------------------------------- | --------------------------------- |
| Static pages          | Rendered on request              | Pre-rendered to `dist/`           | Served from `dist/`               |
| Dynamic routes        | Resolved at request time         | Expanded via `getStaticPaths`     | Served from `dist/`               |
| Unknown routes        | Returns "Page not found" message | 404 (no file on disk)             | Serves `dist/404.html` with 404   |
| API routes (`/api/*`) | Nitro dev server handles them    | Not available                     | Nitro server handles them         |
| Links                 | Absolute paths (`/about`)        | Rewritten to relative (`./about`) | Rewritten to relative (`./about`) |

### Trailing-slash redirects

The Nitro catch-all server redirects bare directory paths (e.g. `/docs`) to include a trailing slash (`/docs/`). This ensures that relative links inside the page (like `./name`) resolve correctly to `/docs/name` rather than `/name`.

## File Structure Reference

```
src/pages/
  home.html             → /          (root page)
  about.html            → /about
  404.html              → (error page, dist/404.html)
  [id].html             → /:id       (dynamic, needs getStaticPaths for build)
  docs/
    index.html          → /docs
    [slug].html         → /docs/:slug (dynamic, needs getStaticPaths for build)
```
