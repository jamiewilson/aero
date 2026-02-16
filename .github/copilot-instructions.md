# Aero Framework - AI Coding Instructions

Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

## Architecture Overview

Aero is a static site generator with a custom HTML-first template engine. The **framework** lives in **packages/core**; the **app** (starter) lives in **packages/start** (src/, server/). Root is the workspace.

### Monorepo

- **packages/core** - Compiler, runtime, Vite plugin (parser, codegen, resolver, vite/, runtime/). Built with tsup; consumed as `@aero-ssg/core` and `@aero-ssg/vite`.
- **packages/vscode** - VS Code extension.
- **packages/start** - Starter app: src/, server/, vite.config.ts, nitro.config.ts. Root scripts delegate to start and core.

### Compilation pipeline (packages/core)

1. **Parser** (packages/core/compiler/parser.ts) extracts `<script on:build>` and `<script on:client>` blocks from HTML
2. **Codegen** (packages/core/compiler/codegen.ts) compiles templates into async render functions with `{ }` interpolation
3. **Vite Plugin** (packages/core/vite/index.ts) orchestrates the build, serves pages via middleware, and handles virtual modules for client scripts
4. **Runtime** (packages/core/runtime/index.ts) provides the `Aero` class that renders pages and components with context

## Key Conventions

### Component Naming

Components use `-component` or `-layout` suffix in markup and are imported without suffix:

```html
<script on:build>
	import header from '@components/header' <!-- resolves header.html -->
</script>
<header-component title="Hello" />
```

### Script Types

- `<script on:build>` - Runs at build time, has access to `aero.props`, `site` globals, imports
- `<script on:client>` - Bundled as virtual module, runs in browser
- `<script src="...">` - External scripts allowed without attributes
- **Required**: All inline scripts must have `on:client` or `on:build` attribute

### Props System

Props passed via attributes or `data-props`:

```html
<my-component title="{ site.title }" />
<my-component data-props />
<my-component data-props="{ ...baseProps }" />
```

Components receive via `aero.props` in `<script on:build>`.

### Path Aliases (root tsconfig.json)

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
pnpm run dev          # Vite dev server with HMR
pnpm run build        # Static build to dist/; with Nitro also .output/
pnpm run preview      # Static preview
pnpm run preview:api  # Full server preview
pnpm test             # Vitest (packages/core)
```

## File Structure (root)

- `src/pages/` - Route pages
- `src/components/` - Reusable components
- `src/layouts/` - Layout wrappers with `<slot>` support
- `src/content/` - Global data (site.ts, theme.ts → `site` in templates)
- `src/assets/` - Styles, scripts, images
- `server/api/` - Nitro API handlers
- `server/routes/` - Nitro routes (e.g. catch-all for dist/)

## Client Stack

- **Alpine.js** - x-data, x-model, :disabled etc. preserved (not interpolated)
- **HTMX** - hx-post, hx-target etc. passed through
- Alpine attrs match `^(x-|[@:.]).*` and skip `{ }` interpolation

## Gotchas

- Virtual client scripts use `/@aero/client/` prefix; plugin uses `\0` for Vite virtual modules
- Slot passthrough: both `name` and `slot` on `<slot>` elements
- `data-each` for loops: `<li data-each="{ item in items }">{ item.name }</li>`
