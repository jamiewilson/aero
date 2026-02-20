# v2 Script Taxonomy

Aero features a clear and explicit taxonomy for `<script>` tags, making it easy to reason about when and where your JavaScript code executes.

The previous `on:build` and `on:client` attributes have been deprecated in favor of three distinct `is:*` attributes: `is:build`, `is:bundled`, and `is:inline`.

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

### `is:bundled`

The `is:bundled` attribute declares a client-side module script that gets processed natively by Vite.

- **Execution Context:** Runs in the client's browser.
- **Purpose:** Handling interactive front-end logic, importing client-side libraries via NPM, and utilizing Vite's Hot Module Replacement (HMR) during development.
- **Bundling:** Aero hands the contents of these scripts over to Vite as a virtual module (`/@aero/client/...`). Vite automatically minifies, chunks, and optimizes the code based on your production settings.
- **Data Passing:** You can safely bridge context from the server down to these modules using the `pass:data` directive.

```html
<script is:bundled pass:data="{ { apiToken } }">
	// Evaluates in the browser with `apiToken` already in scope!
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
- Replace `<script on:client>` with `<script is:bundled>`

If you had any `on:client` scripts that you intended to be completely externalized from Vite's bundling pipeline (e.g., inline analytics init), change them to `<script is:inline>` instead.
