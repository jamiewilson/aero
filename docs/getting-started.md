# Getting Started

This guide walks you through creating your first Aero project — from installation to pages, components, layouts, and data.

## Create a Project

```bash
pnpm create aerobuilt my-app
cd my-app
pnpm dev
```

Open `http://localhost:5173` to see your site.

The scaffolded project looks like this:

```
my-app/
├── client/
│   ├── assets/
│   │   ├── scripts/    # Client-side TypeScript/JavaScript
│   │   └── styles/     # CSS files
│   ├── components/     # Reusable .html components
│   ├── layouts/        # Layout wrappers with <slot>
│   └── pages/          # File-based routing
├── content/
│   └── site.ts         # Global site data
├── public/             # Static assets (copied as-is)
├── vite.config.ts      # Aero Vite plugin
└── tsconfig.json       # Path aliases
```

---

## Pages

Every `.html` file in `client/pages/` becomes a route:

| File                           | URL      |
| ------------------------------ | -------- |
| `client/pages/index.html`      | `/`      |
| `client/pages/about.html`      | `/about` |
| `client/pages/docs/index.html` | `/docs`  |

Create a new page at `client/pages/contact.html`:

```html
<h1>Contact</h1>
<p>Get in touch at hello@example.com</p>
```

Visit `http://localhost:5173/contact` — it works immediately. No routing config needed.

> For the full routing guide (dynamic routes, `getStaticPaths`, 404 pages), see [routing.md](routing.md).

---

## Layouts

Layouts wrap pages with shared structure (HTML head, navigation, footer). They use `<slot>` to mark where page content goes.

Here's the layout from the minimal template (`client/layouts/base.html`):

```html
<script is:build>
	import meta from '@components/meta'
	import footer from '@components/footer'
</script>

<html lang="en">
	<head>
		<meta-component props="{...Aero.props}" />
		<link rel="stylesheet" href="@styles/global.css" />
		<script type="module">
			import aero from 'aerobuilt'
			aero.mount()
		</script>
	</head>

	<body id="app">
		<slot></slot>
		<footer-component />
	</body>
</html>
```

To use a layout, import it in your page's `<script is:build>` and wrap your content with it:

```html
<script is:build>
	import base from '@layouts/base'
</script>

<base-layout>
	<h1>Contact</h1>
	<p>Get in touch at hello@example.com</p>
</base-layout>
```

The layout's `<slot></slot>` is replaced with your page content.

> For named slots and slot passthrough, see [slot-passthrough.md](slot-passthrough.md).

---

## Components

Components are reusable `.html` files in `client/components/`. Import them in `<script is:build>` and use them with a `-component` suffix in markup:

```html
<!-- client/components/greeting.html -->
<script is:build>
	const { name } = aero.props
</script>

<h2>Hello, { name }!</h2>
```

Use it in a page:

```html
<script is:build>
	import base from '@layouts/base'
	import greeting from '@components/greeting'
</script>

<base-layout>
	<greeting-component name="World" />
</base-layout>
```

### Props

Pass data to components via attributes. Use `{ }` for expressions:

```html
<!-- String literal -->
<greeting-component name="World" />

<!-- Expression -->
<greeting-component name="{ site.author }" />

<!-- Spread an object -->
<greeting-component props="{ ...myProps }" />
```

Components receive props via `aero.props`:

```html
<script is:build>
	const { name, greeting = 'Hello' } = aero.props
</script>

<h2>{ greeting }, { name }!</h2>
```

> For the full props guide (spread syntax, inline objects, mixed props), see [props.md](props.md).

---

## Site Data

Put global data in `content/site.ts`. It's automatically available as `site` in your templates:

```ts
// content/site.ts
export default {
	meta: {
		title: 'My Site',
		description: 'Built with Aero',
	},
	nav: [
		{ label: 'Home', path: '/' },
		{ label: 'About', path: '/about' },
	],
}
```

Use it in any template or component:

```html
<script is:build>
	import site from '@content/site'
</script>

<title>{ site.meta.title }</title>
<nav>
	<a each="{ link in site.nav }" href="{ link.path }">{ link.label }</a>
</nav>
```

> For content collections (Markdown with schemas), see [content-api.md](content-api.md).

---

## Scripts

Aero has two main script types — build scripts and client scripts:

### `<script is:build>` — Build time

Runs at build time in Node.js. Use it to import components, fetch data, and prepare variables. This code **never** reaches the browser:

```html
<script is:build>
	import header from '@components/header'
	import site from '@content/site'

	const title = site.meta.title
</script>

<header-component title="{ title }" />
```

### `<script>` — Client side

A plain `<script>` tag (no attribute) runs in the browser. It's bundled by Vite with HMR in dev:

```html
<script>
	console.log('This runs in the browser')
	document.querySelector('#app').classList.add('loaded')
</script>
```

### `<script is:inline>` — Inline

Left in the HTML exactly as-is. Not bundled by Vite. Useful for critical scripts that must run immediately (e.g. theme detection):

```html
<script is:inline>
	const theme = localStorage.getItem('theme')
	document.documentElement.setAttribute('data-theme', theme)
</script>
```

> For the full script guide (blocking scripts, `pass:data`, `src` handling), see [script-taxonomy.md](script-taxonomy.md).

---

## Styling

Link CSS files using path aliases:

```html
<link rel="stylesheet" href="@styles/global.css" />
```

Or use `<style>` blocks directly in components:

```html
<header>
	<h1>{ title }</h1>
</header>

<style>
	header {
		padding: 2rem;
		background: var(--surface);
	}
</style>
```

Vite handles CSS bundling, autoprefixing, and minification automatically.

---

## Loops and Conditionals

### Loops

Use `each` to iterate:

```html
<ul>
	<li each="{ item in items }">{ item.name }</li>
</ul>
```

### Conditionals

Use `if`, `else-if`, and `else`:

```html
<div if="{ user }">Hello, { user.name }</div>
<p else>Not logged in.</p>
```

---

## Path Aliases

The `tsconfig.json` in your project defines path aliases so you don't need relative imports:

| Alias           | Resolves to               |
| --------------- | ------------------------- |
| `@components/*` | `client/components/*`     |
| `@layouts/*`    | `client/layouts/*`        |
| `@pages/*`      | `client/pages/*`          |
| `@content/*`    | `content/*`               |
| `@styles/*`     | `client/assets/styles/*`  |
| `@scripts/*`    | `client/assets/scripts/*` |
| `@images/*`     | `client/assets/images/*`  |

---

## Commands

| Command        | Description                     |
| -------------- | ------------------------------- |
| `pnpm dev`     | Start the dev server with HMR   |
| `pnpm build`   | Build for production to `dist/` |
| `pnpm preview` | Preview the built site          |

---

## Next Steps

Now that you have the basics, explore the reference docs:

- **[Routing](routing.md)** — Dynamic routes, `getStaticPaths`, nested directories
- **[Props](props.md)** — All the ways to pass and receive data
- **[Scripts](script-taxonomy.md)** — Script types, `pass:data`, bundling
- **[Content](content-api.md)** — Collections, Markdown, `getCollection()` / `render()`
- **[Nitro](nitro-overview.md)** — API routes and server-side features
- **[HTMX & Alpine](htmx-and-alpine.md)** — Client interactivity
- **[Configuration](../README.md#configuration)** — Vite plugin options, `aero.config.ts`
