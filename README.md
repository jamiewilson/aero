# ⚡ Aero

Aero (`aerobuilt` on npm) is a static site generator and full-stack framework with an HTML-first template engine. You write `.html` files with optional `<script>` and `<style>`; Aero compiles them at build time, outputs static HTML (and optionally a Nitro server), and plays nicely with [HTMX](https://htmx.org) and [Alpine.js](https://alpinejs.dev) for interactivity. Links: [aerobuilt](https://www.npmjs.com/package/aerobuilt) — [create-aerobuilt](https://www.npmjs.com/package/create-aerobuilt) — [aero-vscode](https://marketplace.visualstudio.com/items?itemName=aerobuilt.aero-vscode)

<hr>

🛤️ **File-based routing:** `/pages/about.html` → `/about`; dynamic routes with `getStaticPaths`.

🧩 **Components & Layouts:** Import `.html` templates; use `<name-component>` and `<name-layout>`.

📤 **Props:** Pass data via attributes or `props`; read with `aero.props` in the component.

🔀 **Loops & conditionals:** `each` and `if/else-if/else` right in your markup.

🎰 **Slots:** Layouts expose `<slot>`; pass content with `slot` and `name` attributes.

📁 **Content as code:** Put data in `content/`; use `getCollection()` and markdown with `render()`.

💾 **Server when you need it:** Default is static; easily enable Nitro for API routes and a server.

📦 **Plain HTML output:** No hydration, no framework runtime; deploy anywhere.

## Try it out

```bash
# scaffold a new projet
pnpm create aerobuilt my-app
# or use dlx (or npx)
pnpm dlx create-aerobuilt@latest my-app
# add to an existing project
pnpm add aerobuilt
```

## The Basics

A page is just HTML with a build script, a layout, and components. Data comes from `content/` and is interpolated with `{ }`. Build-time code lives in `<script is:build>` and is stripped from the output; plain `<script>` is bundled for the browser.

```html
<script is:build>
	import base from '@layouts/base'
	import header from '@components/header'
	import site from '@content/site'
</script>

<base-layout>
	<header-component title="{ site.title }" subtitle="{ site.subtitle }" />
	<p>{ site.description }</p>
</base-layout>

<script>
	import someFunction from '@scripts/someModule'
	someFunction()
</script>
```

## Mostly just html, css and js/ts, with few things on top

Aero tries to stay as close to the web platform as possible: you write HTML files (not JSX), plain CSS, and plain client JS (Alpine, HTMX, vanilla, or none). Output is static HTML with no hydration or framework runtime. The thin layer Aero adds is just `{ }` expressions, `<script is:build>` (and `is:inline`, `is:blocking`), `each`/`if`/`else` directives, component imports with `-component`/`-layout`, and props (`aero.props`, `props`, `pass:data`). The source looks like HTML, the output is HTML.

> Also check out: [What Makes Aero Different?](docs/what-makes-aero-different.md) and [Why Not Web Components?](docs/why-not-web-components.md)

### 🛤️ File-based routing

File paths under `client/pages/` become routes. A minimal project scaffold:

```plaintext
.
├── client/
│   ├── pages/
│   │   ├── index.html          → /
│   │   ├── about.html          → /about
│   │   └── blog/
│   │       └── [slug].html     → /blog/:slug
│   ├── layouts/
│   │   └── base.html           → <base-layout>
│   └── components/
│       ├── header.html         → <header-component>
│       └── footer.html         → <footer-component>
├── content/
├── public/
└── vite.config.ts
```

- **Pages** live in `client/pages/`; the path and filename determine the URL (`index.html` = that segment’s root).
- **Layouts** live in `client/layouts/`; use `<name-layout>` in markup (e.g. `base.html` → `<base-layout>`).
- **Components** live in `client/components/`; use `<name-component>` (e.g. `header.html` → `<header-component>`).
- **Path aliases**: For convenience, `create-aerobuilt` gives you: `@client/*`, `@pages/*`, `@layouts/*`, `@components/*`, and more out of the box. See `tsconfig.json` for all of them.

> [!NOTE]  
> For dynamic routes (e.g. `blog/[slug].html`), export `getStaticPaths()` from the page’s build script so the build knows which paths to generate. See [Conventions](#conventions) and [docs/content-api.md](docs/content-api.md).

### 🧩 Components & Layouts

Import `.html` templates without the extension; use `<name-component>` or `<name-layout>` in markup. The import resolves to the template file (e.g. `header` → `header.html`):

```html
<script is:build>
	import base from '@layouts/base'
	import header from '@components/header'
</script>

<base-layout>
	<header-component title="Hello" subtitle="World" />
	<p>Page content here.</p>
</base-layout>
```

Layouts wrap pages and expose `<slot>` for content; see [Slots](#-slots) below.

### 📤 Props

Pass data into components via attributes (with `{ }` expressions) or via the `props` attribute. Inside the component, read from `aero.props` (or `Aero.props`).

**1. `props` shorthand** — If you have a variable named `props` in the build script, use the bare `props` attribute to pass it. The component receives that object as its props:

```html
<!-- Page -->
<script is:build>
	import base from '@layouts/base'
	import card from '@components/card'
	const props = { title: 'Hello', subtitle: 'World', accent: 'blue' }
</script>

<base-layout>
	<card-component props />
</base-layout>
```

**2. Spreading an object** — Use `props="{ ...obj }"` to pass any object as the component’s props:

```html
<card-component props="{ ...cardProps }" />
<!-- or build the object inline -->
<card-component props="{ title: site.title, subtitle: site.tagline }" />
```

**3. `pass:data` into script and style** — To use build-scope data inside a client `<script>` or `<style>`, add `pass:data` with a **braced expression** (one `{ }`). The expression is evaluated at render time and must produce an object; its keys become global variables in script or CSS custom properties in style (e.g. `--fg`, `--bg`). Same interpolation rules as elsewhere: what you write is the expression.

- **Multiple variables in script:** `pass:data="{ title, accent }"` — object literal, so `title` and `accent` become globals.
- **Object’s properties as CSS vars in style:** `pass:data="{ ...theme }"` — spread so the theme’s keys become `--fg`, `--bg`, `--accent`. Passing `{ theme }` would give a single key `--theme` (the whole object), not per-property vars.

```html
<script is:build>
	const { title, subtitle, accent } = aero.props
	const theme = { fg: '#111', bg: '#fff', accent }
</script>

<div class="card">
	<h2>{ title }</h2>
	<p>{ subtitle }</p>
</div>

<style pass:data="{ ...theme }">
	.card {
		color: var(--fg);
		background: var(--bg);
		border: 4px solid var(--accent);
	}
</style>

<script pass:data="{ title, accent }">
	console.log('Card:', title, accent)
</script>
```

> [!NOTE]
> All custom attributes (`props`, `each`, `if`, `else`, etc.) also accept a `data-` prefix (e.g. `data-props`, `data-each`) for strict HTML spec compliance. Both forms are equivalent; the shorthand is preferred for readability.

### 🔀 Loops & conditionals

Use `each` and `if` / `else-if` / `else` with `{ }` expressions:

```html
<ul>
	<li each="{ item in items }">{ item.name }</li>
</ul>

<div if="{ user }">Hello, { user.name }</div>
<p else>Not logged in.</p>
```

### 🎰 Slots

Layouts expose `<slot>` to receive content from the page (or from a nested layout). Content between the layout’s opening and closing tags fills the slot.

#### 1. The default slot

One layout, one `<slot>`. Whatever you put between the layout tags is rendered where the slot is:

**Layout (`layouts/base.html`):**

```html
<html>
	<head>
		<!-- Head stuff -->
	</head>
	<body>
		<header>Site header</header>
		<slot></slot>
		<footer>Site footer</footer>
	</body>
</html>
```

**Page** — content between `<base-layout>` and `</base-layout>` goes into the default slot:

```html
<script is:build>
	import base from '@layouts/base'
</script>

<base-layout>
	<h1>About</h1>
	<p>This paragraph and the heading above fill the default slot.</p>
</base-layout>
```

#### 2. Nested layout

A layout can use another layout. The inner layout’s `<slot>` receives the page content; the outer layout’s `<slot>` receives the inner layout’s output. So the page content flows: page → inner layout’s slot → outer layout’s slot.

**Outer layout (`layouts/base.html`):** same as above with `<slot></slot>` in `<main>`.

**Inner layout (`layouts/sub.html`)** — wraps itself in the base layout and exposes its own default slot:

```html
<script is:build>
	import base from '@layouts/base'
</script>

<base-layout>
	<slot></slot>
</base-layout>
```

**Page** — use the inner layout; your content goes into its slot, which is then wrapped by the base layout:

```html
<sub-layout>
	<h1>Docs</h1>
	<p>This page uses a nested layout: sub → base.</p>
</sub-layout>
```

#### 3. Named slots and pass-through

A layout can define **named slots** with `name="..."`. The page (or an inner layout) passes content into a named slot using the `slot="..."` attribute. To pass content _through_ a nested layout into a grandparent’s named slot, use **slot passthrough**: on the inner layout’s `<slot>`, set both `name` (the name this layout uses for the hole) and `slot` (the grandparent’s slot name it forwards to).

**A page or inner layout** can pass conent to a named slot:

```html
<!-- pages/home.html -->
<sub-layout>
	<a href="#" slot="thru-sub">Link from Home</a>
</sub-layout>
```

**Then in the layout**, incoming content to `thru-sub` is forwarded to the `into-nav` slot inside `layouts/sub.html`:

```html
<!-- layouts/sub.html -->
<base-layout>
	<slot name="thru-sub" slot="into-nav"></slot>
</base-layout>
```

**In the parent layout**, accept the incoming slot and pass all the inner content as the default slot to `<nav-component>`:

```html
<!-- layouts/base.html -->
<nav-component>
	<slot name="into-nav"></slot>
	<a href="#">Link from Base</a>
</nav-component>
```

**So, in the component** you accept the all the slotted content, i.e. both links:

```html
<!-- components/nav.html -->
<nav>
	<slot></slot>
</nav>

<!-- renders as: -->
<nav>
	<a href="#">Link from Home</a>
	<a href="#">Link from Base</a>
</nav>
```

### 📁 Content as code

Put TypeScript or JavaScript in `content/` (e.g. `content/site.ts`). Import in build scripts as `@content/site` and use the exported data in your templates. For content collections (e.g. markdown docs), use `getCollection('name')` and optional `render()` for markdown. See [docs/content-api.md](docs/content-api.md).

```html
<script is:build>
	import site from '@content/site'
	import { getCollection, render } from 'aero:content'

	const docs = await getCollection('docs')
	const { html } = await render(someDoc)
</script>

<h1>{ site.title }</h1>
<section>{ html }</section>
```

### 💾 Server when you need it

By default, `pnpm build` produces a static `dist/`. Enable Nitro in your Vite config for API routes and an optional server. Add handlers under `server/api/`; they are served at `/api/...`.

**`vite.config.ts`:**

```ts
plugins: aero({ nitro: true })
```

**`server/api/submit.post.ts`** — handles `POST /api/submit`:

```ts
import { defineHandler, readBody } from 'nitro/h3'

export default defineHandler(async event => {
	const body = await readBody(event)
	return { ok: true, message: body.message }
})
```

Deploy the `.output/` bundle (see [Build output](#build-output)) for static + API from one app.

### 📦 Plain HTML output

Aero compiles templates to static HTML. Build-time code in `<script is:build>` is stripped; only the markup and any client scripts remain. Script behavior:

- **`<script is:build>`** — Runs at build (or request) time only. One per file. Import components, read `aero.props`, use `Aero.site`, `getCollection()`, etc. Not emitted in output.
- **`<script>` (no attribute)** — Client module: bundled by Vite, emitted and run in the browser. HMR in dev.
- **`<script is:inline>`** — Left in the HTML as-is; runs in the browser immediately (e.g. theme FOUC fix, analytics).
- **`<script is:blocking>`** — Moved into `<head>` for blocking scripts.

There is no hydration and no framework runtime in the output; you can deploy to any static host or use Nitro for a full server.

## Tools and commands

- **[create-aerobuilt](https://www.npmjs.com/package/create-aerobuilt)** — Scaffold a new app: `pnpm create aerobuilt my-app`.

- **VS Code Extension** — The `packages/aero-vscode` extension adds syntax and diagnostics for Aero templates.

## Configuration

#### In`vite.config.ts`, the `aero()` plugin supports:

- **`nitro`** (boolean) — Enable Nitro (API + optional server). Default `false`.
- **`site`** (string) — Canonical site URL (e.g. `'https://example.com'`). Used for sitemap, RSS, canonical/OG tags. Exposed as `import.meta.env.SITE` and `Aero.site` in templates.
- **`redirects`** — `[{ from, to, status? }]`. Applied in dev and passed to Nitro for production (use `redirectsToRouteRules()` from `@aerobuilt/config` in `nitro.config.ts`).
- **`middleware`** — Optional request-time handlers in dev (redirects, rewrites, custom responses).
- **`dirs`** — Override `client`, `server`, `dist` (defaults: `client`, `server`, `dist`).
- **`apiPrefix`** — URL prefix for API routes (default `/api`).

You can use **`aero.config.ts`** with `defineConfig` from `@aerobuilt/config` to set `site`, `redirects`, `middleware`, `content`, `server`, etc., and the Vite plugin will pick it up.

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

## Commands

Commands in a `create-aerobuilt` project:

- `pnpm install` then `pnpm dev` — Build core and run the example app.
- `pnpm build` — Static build to `dist/`; with Nitro enabled, also `.output/`.
- `pnpm preview` — Static preview.
- `pnpm preview:api` — Preview with Nitro (static + API from one origin).
- `pnpm test` — Run Vitest (packages/core).

## Build output

- **Static only:** `pnpm build` → `dist/`. Deploy to any static host or open via `file://`.
- **With Nitro:** Same build also produces `.output/` (e.g. `.output/public/` for static, `.output/server/` for the server). Deploy `.output/` for API + static from one app.

## More Documentation

For more documentation, see the [`/docs`](/docs) directory, starting with the [Table of Contents](docs/README.md).

## Links

- [aerobuilt](https://www.npmjs.com/package/aerobuilt)
- [create-aerobuilt](https://www.npmjs.com/package/create-aerobuilt)
- [@aerobuilt/core](https://www.npmjs.com/package/@aerobuilt/core)
- [@aerobuilt/content](https://www.npmjs.com/package/@aerobuilt/content)
- [@aerobuilt/config](https://www.npmjs.com/package/@aerobuilt/config)
- [@aerobuilt/template-minimal](https://www.npmjs.com/package/@aerobuilt/template-minimal)
- [Aero VSCode](https://marketplace.visualstudio.com/items?itemName=aerobuilt.aero-vscode)

## Inspiration

Aero draws inspiration from and shares ideas with the following projects:

- **[Astro](https://astro.build)** — A web framework for building content-driven websites.
- **[Vite](https://vitejs.dev)** — A fast, modern frontend tooling.
- **[Nitro](https://nitro.build)** — A server engine and deployment flexibility.
- **[HTMX](https://htmx.org)** — AJAX, CSS Transitions, WebSockets and Server Sent via html attributes.
- **[Alpine.js](https://alpinejs.dev)** — A lightweight tool for composing behavior directly in your markup.
