# Aero Framework - AI Coding Instructions

## Architecture Overview

Aero is a static site generator with a custom HTML-first template engine. The **framework** lives in **packages/core**; the **app** (pages, components, config) lives in **packages/start**; the repo root is the workspace root.

### Monorepo

- **packages/core** - Compiler, runtime, Vite plugin. Built with tsup; used as `@aero-ssg/core` and `@aero-ssg/vite`. Run tests from root with `pnpm test` (Vitest in packages/core).
- **packages/vscode** - VS Code extension (syntaxes for Aero templates).
- **packages/start** - Starter app: `src/`, `server/`, vite.config.ts, nitro.config.ts, tsconfig.json. Depends on `@aero-ssg/vite`.
- **Root** - Workspace root. Scripts delegate: `pnpm dev` builds core then runs start's dev; `pnpm test` runs core tests.

### Compilation pipeline (packages/core)

1. **Parser** (packages/core/compiler/parser.ts) extracts `<script is:build>`, client (plain `<script>`), `<script is:inline>`, and `<script is:blocking>` blocks from HTML
2. **Codegen** (packages/core/compiler/codegen.ts) compiles templates into async render functions with `{ }` interpolation
3. **Vite Plugin** (packages/core/vite/index.ts) orchestrates the build, serves pages via middleware, and handles virtual modules for client scripts
4. **Runtime** (packages/core/runtime/index.ts) provides the `Aero` class that renders pages and components with context

## Key Conventions

### Component Naming

Components use `-component` or `-layout` suffix in markup and are imported without suffix:

```html
<script is:build>
	import header from '@components/header' <!-- resolves header.html -->
</script>
<header-component title="Hello" />
```

### Script Types

- `<script is:build>` - Runs at build time; has access to `aero.props`, `Aero.site` (canonical URL from config), `site` globals (from content), imports. One per template.
- Plain `<script>` (no `is:*`) - Bundled as virtual module, runs in browser (client).
- `<script is:inline>` - Left in place in HTML; not bundled by Vite; runs in browser immediately.
- `<script is:blocking>` - Extracted and emitted in `<head>` (e.g. blocking scripts).
- `<script src="...">` - External scripts allowed without attributes.
- See [docs/script-taxonomy.md](docs/script-taxonomy.md) for full taxonomy.

### Props System

Props passed via attributes or `data-props`:

```html
<my-component title="{ site.title }" />
<!-- expression -->
<my-component data-props />
<!-- spreads local `props` var -->
<my-component data-props="{ ...baseProps }" />
<!-- explicit spread -->
```

Components receive via `aero.props`:

```html
<script is:build>
	const { title, subtitle } = aero.props
</script>
```

### Path Aliases (packages/start/tsconfig.json)

- `@components/*` → src/components/\*
- `@layouts/*` → src/layouts/\*
- `@pages/*` → src/pages/\*
- `@content/*` → src/content/\*
- `@styles/*` → src/assets/styles/\*
- `@scripts/*` → src/assets/scripts/\*
- `@images/*` → src/assets/images/\*
- `@src/*` → src/\*
- `@server/*` → server/\*
- `~/*` → project root

## Development Commands

```bash
pnpm run dev          # Vite dev server with HMR (Nitro when aero({ nitro: true }))
pnpm run build        # Static build to dist/; with Nitro also .output/
pnpm run preview      # Static preview only
pnpm run preview:api  # Full server preview (static + API)
pnpm test             # Run Vitest (packages/core compiler + vite tests)
```

## Testing

Tests use Vitest and live in **packages/core**: `compiler/__tests__/` (parser, codegen, vite-plugin), `vite/__tests__/` (build). Run with `pnpm test` from repo root.

## Client Stack Integration

- **Alpine.js** - Attributes like `x-data`, `x-model`, `:disabled` are preserved (not interpolated)
- **HTMX** - Attributes like `hx-post`, `hx-target` are passed through
- Alpine attributes use regex `^(x-|[@:.]).*` to skip `{ }` interpolation

## Configuration (site URL)

Optional `site` (canonical URL, e.g. `'https://example.com'`) can be set in `aero.config.ts` (`site: '...'`) or passed to `aero({ site: '...' })`. It is exposed as `import.meta.env.SITE` at build time and as `Aero.site` in templates. Used for sitemap, RSS, and canonical/Open Graph URLs. See [docs/site-url.md](docs/site-url.md).

## File Structure

- **packages/start:** `src/pages/`, `src/components/`, `src/layouts/`, `src/content/`, `src/assets/`, `server/api/`, `server/routes/`
- **packages/core/** - Framework (compiler, runtime, vite)
- **packages/vite/** - Vite plugin re-export
- **packages/vscode/** - VS Code extension

For a detailed monorepo and packages layout, see [docs/monorepo-and-packages.md](docs/monorepo-and-packages.md).

## Gotchas

- Virtual client scripts use `/@aero/client/` prefix - plugin uses `\0` prefix for proper Vite virtual module handling
- Slot passthrough uses both `name` and `slot` attributes on `<slot>` elements
- `data-each` for loops: `<li data-each="{ item in items }">{ item.name }</li>`
