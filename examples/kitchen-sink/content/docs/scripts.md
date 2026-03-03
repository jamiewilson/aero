---
published: true
title: Scripts
subtitle: When and where your JavaScript runs — build time vs client, and the script types you need.
---

Aero uses a clear script taxonomy so you always know when and where code runs. Getting this right avoids "why isn't this available at build?" and "why isn't this in the browser?" confusion.

## is:build

Use `<script is:build>{:html}` for code that runs only at build time (or request time when using a server). This code never reaches the browser.

- Runs in Node; one per template file.
- Use it to import components, read `aero.props` or `Aero.params`, load content, and prepare data before the template becomes HTML.
- The compiler inlines it into the render module that powers the static build.

Example:

```html
<script is:build>
	import Header from '@components/header'
	const title = 'Welcome to Aero'
</script>

<header-component title="{ title }" />
```

## Plain script (client)

A `<script>{:html}` tag with no `is:*` attribute is a client-side module. Aero passes it to Vite as a virtual module; Vite bundles, minifies, and hoists it to the end of the body.

- Runs in the browser; gets HMR in development.
- Use it for interactive logic and client-only imports.
- Use the `pass:data` directive to inject build-time data into the module.

Example:

```html
<script pass:data="{ apiToken }">
	import { initAnalytics } from 'my-analytics'
	initAnalytics(apiToken)
</script>
```

## is:inline

Use `<script is:inline>{:html}` when you want a script to stay exactly where it is in the HTML and run immediately, without being bundled by Vite.

- Not hoisted, not bundled, not minified.
- Good for: reading theme from localStorage before paint (avoid FOUC), or embedding a small third-party snippet (e.g. analytics) directly in the page.

Example:

```html
<script is:inline>
	const theme = localStorage.getItem('theme')
	document.documentElement.setAttribute('data-theme', theme || 'light')
</script>
```

## is:blocking

Use `<script is:blocking>{:html}` when the script must run before the rest of the page. The compiler moves it into `<head>{:html}`.

- Use for critical init that must run early. Attributes like `<script type="module">{:html}` or `defer` are ignored or warned on.

## Scripts with src

- **External URLs** (`<script src="https://...">{:html}`) are left as-is; the tag is not bundled.
- **Local paths** (`<script src="@scripts/foo.ts">{:html}` or `<script src="./foo.js">{:html}`) are resolved with your path aliases, bundled by Vite, and rewritten to hashed asset URLs at build time. They use the asset pipeline, not the virtual client script pipeline.

## Summary

- **Build-only:** `<script is:build>{:html}` — one per file; never in the browser.
- **Client bundle:** plain `<script>{:html}` — Vite bundles it; use `pass:data` for server data.
- **Inline in place:** `<script is:inline>{:html}` — not bundled; runs immediately.
- **In head:** `<script is:blocking>{:html}` — moved to `<head>{:html}`.
- **External:** `<script src="https://...">{:html}` — unchanged. Local `src` — bundled and hashed.
