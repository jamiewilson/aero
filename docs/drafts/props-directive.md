# Built-in Data Passing (`props` / `data-props`)

A common struggle in modern web frameworks is bridging data computed securely on the server down to the client-side JavaScript securely and easily.

Aero simplifies context passing completely using the intuitive `props` (or `data-props`) attribute available on both `<script>` and `<style>` tags.

## Core Concepts

The `props` syntax accepts JavaScript object-literal interpolations evaluated inside the template compiler.

By utilizing braces `props="{ { variable } }"`, you instruct the compiler to extract the object literal `{ variable: variable }`, execute it in the server scope (`is:build`), serialize the result, and transparently make the destructured properties available as fully-typed constants in the browser.

## Using `props` in Client Scripts

### Passing Data to `is:inline` Scripts

Inline client scripts are directly embedded into the HTML. When interacting with `props`, Aero safely wraps the inline script in an isolated block scope `{ ... }` so the variables don't leak onto the `window` object.

```html
<script is:build>
	const systemConfig = { timeout: 5000, theme: 'light' }
	const API_KEY = '1234abcd'
</script>

<!-- The compiler safely block-scopes the passed properties -->
<script is:inline props="{ { systemConfig, key: API_KEY } }">
	console.log(systemConfig.theme) // "light"
	console.log(key) // "1234abcd"

	// These variables are trapped locally and don't pollute the window.
</script>
```

### Passing Data to Client (Plain) Script Modules

To prevent data serialization strings from congesting chunk sizes, plain `<script>` (client) elements use a **DOM JSON + Auto-Inject** architecture for data passing:

1. **JSON Tag rendering**: Aero serializes the props data locally into the HTML alongside the bundled request. E.g `<script type="application/json" id="__aero_data_xyz">{"systemConfig":{"timeout":5000}}</script>`
2. **Vite auto-injection**: Aero hooks into Vite to prepend a destructuring `JSON.parse` to the virtual module.

```html
<script is:build>
	const envStatus = process.env.STATUS
</script>

<script props="{ { envStatus } }">
	// "envStatus" feels like magic here.
	// Under the hood, Aero automatically prefixes the module with:
	// const { envStatus } = JSON.parse(document.getElementById('__aero_data')?.textContent || '{}');

	import { Application } from './client/app'
	Application.boot(envStatus)
</script>
```

Because ES modules are strictly scoped by definition, global variable pollution isn't an issue.

## Using `props` in Styles

You can dynamically bind component-level configuration natively into CSS by attaching `props` onto `<style>` blocks.

Behind the scenes, the variables get directly hoisted as root-level custom CSS elements (`--prop-name`) within a targeted scope isolation.

```html
<script is:build>
	const designTokens = {
		primaryBg: '#ff0000',
		primaryFg: '#ffffff',
	}
</script>

<!-- Converts Javascript data mapping into CSS variables! -->
<style props="{ ...designTokens }">
	.button {
		background-color: var(--primaryBg);
		color: var(--primaryFg);
	}
</style>
```

The server dynamically complies the data into the following CSS rules and attaches them before rendering:

```css
:root {
	--primaryBg: #ff0000;
	--primaryFg: #ffffff;
}
.button {
	background-color: var(--primaryBg);
	color: var(--primaryFg);
}
```
