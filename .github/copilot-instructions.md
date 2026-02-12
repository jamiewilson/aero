# TBD Framework - AI Coding Instructions

Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

## Architecture Overview

TBD is a static site generator with a custom HTML-first template engine. The **framework** lives in **packages/tbd**; the **app** lives at the repo root in **src/** and **server/**.

### Monorepo

- **packages/tbd** - Compiler, runtime, Vite plugin (parser, codegen, resolver, vite/, runtime/). Built with tsup; consumed as `tbd` and `tbd/vite`.
- **packages/tbd-vscode** - VS Code extension.
- **Root** - App: src/pages, src/components, src/layouts, src/content, src/assets; server/api, server/routes; vite.config.ts, nitro.config.ts.

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
<my-component data-props />
<my-component data-props="{ ...baseProps }" />
```

Components receive via `tbd.props` in `<script on:build>`.

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
pnpm run dev          # Vite dev server with HMR
pnpm run build        # Static build to dist/; with Nitro also .output/
pnpm run preview      # Static preview
pnpm run preview:api  # Full server preview
pnpm test             # Vitest (packages/tbd)
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

- Virtual client scripts use `/@tbd/client/` prefix; plugin uses `\0` for Vite virtual modules
- Slot passthrough: both `name` and `slot` on `<slot>` elements
- `data-each` for loops: `<li data-each="item in items">{ item.name }</li>`
