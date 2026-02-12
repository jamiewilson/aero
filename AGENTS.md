# TBD Framework - AI Coding Instructions

## Architecture Overview

TBD is a static site generator with a custom HTML-first template engine. The **framework** lives in **packages/tbd**; the **app** (pages, components, config) lives at the repo root.

### Monorepo

- **packages/tbd** - Compiler, runtime, Vite plugin. Built with tsup; used as dependency `tbd` and `tbd/vite`. Run tests from root with `pnpm test` (Vitest in packages/tbd).
- **packages/tbd-vscode** - VS Code extension (syntaxes for TBD templates).
- **Root** - App source in `src/`, server in `server/`, config (vite.config.ts, nitro.config.ts, tsconfig.json). Root package.json has `predev`/`prebuild` to build packages/tbd first.

### Compilation pipeline (packages/tbd)

1. **Parser** (packages/tbd/compiler/parser.ts) extracts `<script on:build>` and `<script on:client>` blocks from HTML
2. **Codegen** (packages/tbd/compiler/codegen.ts) compiles templates into async render functions with `{ }` interpolation
3. **Vite Plugin** (packages/tbd/vite/index.ts) orchestrates the build, serves pages via middleware, and handles virtual modules for client scripts
4. **Runtime** (packages/tbd/runtime/index.ts) provides the `TBD` class that renders pages and components with context

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

- `<script on:build>` - Runs at build time, has access to `tbd.props`, `site` globals, imports
- `<script on:client>` - Bundled as virtual module, runs in browser
- `<script src="...">` - External scripts allowed without attributes
- **Required**: All inline scripts must have `on:client` or `on:build` attribute

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

Components receive via `tbd.props`:

```html
<script on:build>
	const { title, subtitle } = tbd.props
</script>
```

### Path Aliases (root tsconfig.json)

- `@components/*` → src/components/*
- `@layouts/*` → src/layouts/*
- `@pages/*` → src/pages/*
- `@content/*` → src/content/*
- `@styles/*` → src/assets/styles/*
- `@scripts/*` → src/assets/scripts/*
- `@images/*` → src/assets/images/*
- `@src/*` → src/*
- `@server/*` → server/*
- `~/*` → project root

## Development Commands

```bash
pnpm run dev          # Vite dev server with HMR (Nitro when tbd({ nitro: true }))
pnpm run build        # Static build to dist/; with Nitro also .output/
pnpm run preview      # Static preview only
pnpm run preview:api  # Full server preview (static + API)
pnpm test             # Run Vitest (packages/tbd compiler + vite tests)
```

## Testing

Tests use Vitest and live in **packages/tbd**: `compiler/__tests__/` (parser, codegen, vite-plugin), `vite/__tests__/` (build). Run with `pnpm test` from repo root.

## Client Stack Integration

- **Alpine.js** - Attributes like `x-data`, `x-model`, `:disabled` are preserved (not interpolated)
- **HTMX** - Attributes like `hx-post`, `hx-target` are passed through
- Alpine attributes use regex `^(x-|[@:.]).*` to skip `{ }` interpolation

## File Structure (root)

- `src/pages/` - Route pages (index.html → `/`, about.html → `/about`)
- `src/components/` - Reusable components
- `src/layouts/` - Layout wrappers with `<slot>` support
- `src/content/` - Global data (e.g. site.ts, theme.ts; exposed as `site` in templates)
- `src/assets/` - Styles, scripts, images
- `server/api/` - Nitro API handlers (e.g. submit.post.ts)
- `server/routes/` - Nitro routes (e.g. catch-all for dist/)
- `packages/tbd/` - Framework (compiler, runtime, vite)
- `packages/tbd-vscode/` - VS Code extension

For a detailed monorepo and packages layout, see [_reference/monorepo-and-packages.md](_reference/monorepo-and-packages.md).

## Gotchas

- Virtual client scripts use `/@tbd/client/` prefix - plugin uses `\0` prefix for proper Vite virtual module handling
- Slot passthrough uses both `name` and `slot` attributes on `<slot>` elements
- `data-each` for loops: `<li data-each="item in items">{ item.name }</li>`
