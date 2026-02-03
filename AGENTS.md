# TBD Framework - AI Coding Instructions

## Architecture Overview

TBD is a static site generator with a custom HTML-first template engine. The compilation pipeline:

1. **Parser** ([src/compiler/parser.ts](../src/compiler/parser.ts)) extracts `<script on:build>` and `<script on:client>` blocks from HTML
2. **Codegen** ([src/compiler/codegen.ts](../src/compiler/codegen.ts)) compiles templates into async render functions with `{ }` interpolation
3. **Vite Plugin** ([src/vite/index.ts](../src/vite/index.ts)) orchestrates the build, serves pages via middleware, and handles virtual modules for client scripts
4. **Runtime** ([src/runtime/index.ts](../src/runtime/index.ts)) provides the `TBD` class that renders pages and components with context

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

### Path Aliases (from tsconfig.json)

- `@components/*` → `app/components/*`
- `@layouts/*` → `app/layouts/*`
- `@pages/*` → `app/pages/*`
- `@styles/*` → `app/assets/styles/*`
- `~/*` → project root

## Development Commands

```bash
pnpm run dev          # Vite dev server with HMR (WITH_NITRO=true)
pnpm run build        # Static build to dist/
pnpm run dev:api      # Nitro API server only (port 3000)
```

## Testing

Tests use Vitest. Run with `pnpm test` or `npx vitest`.
Key test files in [src/compiler/**tests**/](../src/compiler/__tests__/).

## Client Stack Integration

- **Alpine.js** - Attributes like `x-data`, `x-model`, `:disabled` are preserved (not interpolated)
- **HTMX** - Attributes like `hx-post`, `hx-target` are passed through
- Alpine attributes use regex `^(x-|[@:.]).*` to skip `{ }` interpolation

## File Structure

- `app/pages/` - Route pages (home.html → `/`, about.html → `/about`)
- `app/components/` - Reusable components
- `app/layouts/` - Layout wrappers with `<slot>` support
- `data/` - Global data (site.ts exposed as `site` in templates)
- `server/api/` - Nitro API handlers (_.post.ts, _.get.ts)

## Gotchas

- Virtual client scripts use `/@tbd/client/` prefix - should use `\0` prefix for proper Vite virtual module handling
- Slot passthrough uses both `name` and `slot` attributes on `<slot>` elements
- `data-each` for loops: `<li data-each="item in items">{ item.name }</li>`
