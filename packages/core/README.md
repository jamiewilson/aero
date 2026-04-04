# @aero-js/core

The core package of the Aero static site generator. It provides the compiler, runtime, and Vite plugin that power Aero’s HTML-first template engine, component system, and build pipeline.

## Overview

- **Compiler** — Parses Aero HTML templates, extracts script blocks, and compiles templates into async render functions (DOM → IR → JS).
- **Runtime** — Renders pages and components with context; supports props, slots, globals, and 404 handling.
- **Vite plugin** — Integrates templates into the Vite build: virtual client modules, HMR, static generation, optional Nitro and image optimization.

## Exports

| Export                           | Description                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `@aero-js/core`                  | Default: shared `aero` instance with `mount()` for the client entry.                             |
| `@aero-js/vite`                  | `aero()` Vite plugin for build and dev. (Re-exported from core.)                                 |
| `@aero-js/core/runtime`          | `Aero` class for programmatic rendering.                                                         |
| `@aero-js/core/runtime/instance` | Shared `aero` instance and `onUpdate` for HMR.                                                   |
| `@aero-js/core/types`            | Shared TypeScript types.                                                                         |
| `@aero-js/core/diagnostics`      | Re-exports `@aero-js/diagnostics` (`AeroDiagnostic`, formatters, mappers).                       |
| `@aero-js/core/compile-check`    | **Node-only:** `compileTemplate` for tooling (e.g. `aero check`). Do not use in browser bundles. |
| `@aero-js/core/utils/aliases`    | `loadTsconfigAliases`, `mergeWithDefaultAliases`, `jitiAliasRecordFromProject`, `resolveDirs`.   |

## Script taxonomy

Script blocks are classified by attributes (see [docs/script-taxonomy.md](https://github.com/jamiewilson/aero/blob/main/docs/script-taxonomy.md) in the repo):

| Script type | Attribute              | When it runs      | Notes                                                                                     |
| ----------- | ---------------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| Build       | `<script is:build>`    | Build time (Node) | One per template; compiles into the render module. Access `aero.props`, globals, imports. |
| Client      | Plain `<script>`       | Browser           | Bundled as a Vite virtual module; HMR. Use `props` to inject build-time data.             |
| Inline      | `<script is:inline>`   | Browser           | Left in place; not bundled. For critical inline scripts (e.g. theme FOUC prevention).     |
| Blocking    | `<script is:blocking>` | Browser           | Extracted and emitted in `<head>`.                                                        |

## Features

### Template compiler

- Parses templates and extracts `<script is:build>`, client (plain `<script>`), `<script is:inline>`, and `<script is:blocking>` blocks.
- Lowers template DOM to an **IR** (intermediate representation), then emits a single async render function with `{ }` interpolation.
- Supports components, slots, `for` / `data-for`, `if` / `else-if` / `else`, and `props` on scripts and styles.

**Example**

```html
<script is:build>
	import header from '@components/header'
	const { title } = aero.props
</script>
<header-component title="{ title }" />
```

### Runtime

- **Aero** class: `global()`, `registerPages()`, `render()`, `renderComponent()`.
- Context includes globals (e.g. from content), props, slots, request, url, params.
- Resolves pages by name with fallbacks (index, trailing slash, `getStaticPaths`); returns `null` for 404 when no static path matches.

**Example**

```js
import { Aero } from '@aero-js/core/runtime'
const aero = new Aero()
aero.global('site', { title: 'My Site' })
// … registerPages, then:
const html = await aero.render('index', { props: { title: 'Home' } })
```

### Vite plugin

- **Plugin** from `@aero-js/vite`: `aero(options?)`. Options: `server`, `apiPrefix`, `dirs`, `site` (canonical URL; exposed as `import.meta.env.SITE` and `Aero.site`; when set, generates `dist/sitemap.xml` after build).
- Sub-plugins: config resolution, virtual client modules (`\0`-prefixed), HTML transform, SSR middleware, HMR.
- Build: page discovery, static render, optional Nitro build, optional image optimizer (sharp/svgo).

**Example**

```js
import { aero } from '@aero-js/vite'
export default {
	plugins: [aero({ server: true })],
}
```

Apps typically use `createViteConfig` from `@aero-js/config/vite` with `defineConfig` from `@aero-js/config` in `aero.config.ts`, which wires the Aero plugin for them.

### Client entry

The default export of `@aero-js/core` is the shared `aero` instance with `mount(options?)` attached. Use it as the browser entry (e.g. in your main script). It does not perform an initial render; it attaches to a root element and subscribes to HMR re-renders in dev.

```js
import aero from '@aero-js/core'
aero.mount({
	target: '#app',
	onRender: el => {
		/* optional */
	},
})
```

### Components and layouts

- Components: use `-component` suffix in markup; import without suffix (e.g. `@components/header` → `header.html`).
- Layouts: use `-layout` and `<slot>` (with `name` and optional `slot` attribute).
- Props: attributes or `props` / `props="{ ... }"`. In build script, read via `aero.props`.

### Path aliases and client stack

- Path aliases (e.g. `@components/*`, `@layouts/*`, `@content/*`) are resolved from the project tsconfig.
- Alpine.js and HTMX attributes (e.g. `x-data`, `:disabled`, `hx-post`) are preserved; attributes matching `^(x-|[@:.]).*` are not interpolated.

## File structure

Template compilation lives in **`@aero-js/compiler`**; this package integrates it via the Vite plugin and runtime.

```
src/
  vite/         # aero() plugin, static build, build manifest, SSR helpers
  runtime/      # Aero class, instance, client entry helpers
  utils/        # aliases, routing
  compile-check-api.ts   # re-exports for aero check
  types.ts, entry-*.ts, ambient.d.ts, diagnostics.ts, index.ts
```

## Tests

Vitest: `src/runtime/__tests__/`, `src/utils/__tests__/`, `src/vite/__tests__/`. Run from repo root: `pnpm test` (see workspace scripts for package-scoped runs).
