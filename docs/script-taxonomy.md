# v2 Script Taxonomy

Aero features a clear and explicit taxonomy for `<script>` tags, making it easy to reason about when and where your JavaScript code executes.

The previous `on:build` and `on:client` attributes have been deprecated in favor of `is:build`, `is:inline`, and plain `<script>` (client).

## Environment Types

### `is:build`

The `is:build` attribute defines the "server-side render body" of your component or page.

- **Execution Context:** Runs entirely at build-time (or request-time for SSR). It runs in Node.js/V8 environment.
- **Purpose:** Used to fetch data, import components, read configuration, and process properties before the template is converted into HTML.
- **Syntax Limitation:** You can only have one `<script is:build>` tag per template file.
- **Output:** This code **never** reaches the browser. It gets compiled into the hidden `export default async function(Aero) { ... }` module that powers the static site generator.

```html
<script is:build>
	import Header from '@components/header'
	const title = 'Welcome to Aero'
</script>

<header title="{title}" />
```

### Plain `<script>` (client)

A `<script>` tag with no `is:*` attribute is treated as a client-side module script and processed by Vite.

- **Execution Context:** Runs in the client's browser.
- **Purpose:** Interactive front-end logic, client-side imports, and Vite HMR during development.
- **Bundling:** Aero hands the contents to Vite as a virtual module (`/@aero/client/...`). Vite minifies, chunks, and optimizes the code.
- **Data Passing:** Use the `pass:data` directive to pass server context into the module.

```html
<script pass:data="{ { apiToken } }">
	import { initAnalytics } from 'my-analytics'
	initAnalytics(apiToken)
</script>
```

### `is:inline`

The `is:inline` attribute tells the compiler to leave the script tag mostly alone and inject it exactly where it sits in the DOM.

- **Execution Context:** Runs in the client's browser as soon as the DOM parser hits the tag.
- **Purpose:** Setting up critical blocking infrastructure, synchronous local storage checks (like immediately applying a dark mode theme to prevent FOUC), or embedding 3P script snippets such as Google Analytics directly into the HTML without relying on a network module request.
- **Processing:** Vite completely ignores these scripts. They are not bundled, minified, or chunked. They run immediately as a classic inline HTML `<script>`.

```html
<script is:inline>
	// Prevents flash-of-unstyled-content (FOUC) by blocking rendering
	// until the theme preference is read from localStorage
	const theme = localStorage.getItem('theme')
	document.documentElement.setAttribute('data-theme', theme)
</script>
```

## Migration from v1

Migrating to the v2 taxonomy is primarily just renaming your script tags:

- Replace `<script on:build>` with `<script is:build>`
- Replace `<script on:client>` with plain `<script>` (client module by default)

If you had any `on:client` scripts that you intended to be completely externalized from Vite's bundling pipeline (e.g., inline analytics init), use `<script is:inline>` instead.
