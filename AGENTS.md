# Aero Framework - AI Coding Instructions

## Architecture Overview

Aero is a static site generator with a custom HTML-first template engine. The **framework** lives in **packages/core**; the **app** used for dev/build is **packages/templates/kitchen-sink**; **packages/start** is the create-aero project initializer (scaffolds from templates). Repo root is the workspace root.

### Monorepo

- **packages/core** - Compiler, runtime, Vite plugin. Built with tsup; used as `@aero-ssg/core` and `@aero-ssg/vite`. Run tests from root with `pnpm test` (Vitest in packages/core).
- **packages/vscode** - VS Code extension (syntaxes for Aero templates).
- **packages/start** - Project initializer (create-aero). Run from `packages/start`: `pnpm run create-aero <name>`; scaffolds into `packages/start/dist/<name>` (gitignored).
- **packages/templates/** - Templates: **kitchen-sink** (full demo app; root `pnpm dev`/build runs this), **minimal** (stripped-down app).
- **Root** - Workspace root. Scripts delegate: `pnpm dev` runs kitchen-sink dev; `pnpm test` runs core tests.

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

### Path Aliases (templates use client/; tsconfig in kitchen-sink, minimal)

- `@components/*` → client/components/\*
- `@layouts/*` → client/layouts/\*
- `@pages/*` → client/pages/\*
- `@content/*` → content/\*
- `@styles/*` → client/assets/styles/\*
- `@scripts/*` → client/assets/scripts/\*
- `@images/*` → client/assets/images/\*
- `@src/*` → client/\*
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

## Client entry and HMR

The recommended client setup is a **single entry** (e.g. `client/assets/scripts/index.ts`) that imports `@aero-ssg/core` and calls `aero.mount()`. Reference it from the layout with `<script type="module" src="@scripts/index.ts"></script>`. Mount attaches to a root element (default `#app`) and subscribes to updates so that on template or content changes the page re-renders in the browser. HMR for templates and content is **dependency-driven**: the client entry pulls in the runtime instance and its globbed pages/layouts/components, so Vite invalidates the right modules and no custom HMR plugin is needed.

## Client Stack Integration

- **Alpine.js** - Attributes like `x-data`, `x-model`, `:disabled` are preserved (not interpolated)
- **HTMX** - Attributes like `hx-post`, `hx-target` are passed through
- Alpine attributes use regex `^(x-|[@:.]).*` to skip `{ }` interpolation

## Configuration (site URL)

Optional `site` (canonical URL, e.g. `'https://example.com'`) can be set in `aero.config.ts` (`site: '...'`) or passed to `aero({ site: '...' })`. It is exposed as `import.meta.env.SITE` at build time and as `Aero.site` in templates. Used for sitemap, RSS, and canonical/Open Graph URLs. See [docs/site-url.md](docs/site-url.md).
- **Environment variables:** Vite’s `import.meta.env`; use `VITE_` prefix for client-exposed vars. Aero injects `SITE` when `site` is set. Optional `env.d.ts` for types. See [docs/environment-variables.md](docs/environment-variables.md).
- **Middleware/hooks:** Optional `middleware` in `aero.config.ts` or `aero({ middleware: [...] })` runs at request time (dev only) for redirects, rewrites, or custom responses. See [_reference/middleware.md](_reference/middleware.md).

## File Structure

- **packages/templates/kitchen-sink:** `client/pages/`, `client/components/`, `client/layouts/`, `content/`, `client/assets/`, `server/api/`, `server/routes/`
- **packages/start/** - create-aero initializer (no app source; scaffolds from templates)
- **packages/core/** - Framework (compiler, runtime, vite)
- **packages/vite/** - Vite plugin re-export
- **packages/vscode/** - VS Code extension

For a detailed monorepo and packages layout, see [docs/monorepo-and-packages.md](docs/monorepo-and-packages.md).

## Gotchas

- Virtual client scripts use `/@aero/client/` prefix - plugin uses `\0` prefix for proper Vite virtual module handling
- Slot passthrough uses both `name` and `slot` attributes on `<slot>` elements
- `data-each` for loops: `<li data-each="{ item in items }">{ item.name }</li>`
