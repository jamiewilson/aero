# Aero Framework - AI Coding Instructions

## Architecture Overview

Aero is a static site generator with a custom HTML-first template engine. The **framework** lives in **packages/core**; the **demo app** is **examples/kitchen-sink**; **packages/create** is the project initializer (scaffolds from templates). Root is the workspace.

### Monorepo

- **packages/core** - Compiler, runtime, Vite plugin (parser, codegen, resolver, vite/, runtime/). Built with tsup; consumed as `@aero-js/core` and `@aero-js/vite`.
- **packages/vscode** - VS Code extension.
- **packages/create** - Project initializer (@aero-js/create). Run `pnpm create @aero-js <name>`; scaffolds into `packages/create/dist/<name>`. Root has no app dev script; run dev/build from **examples/kitchen-sink** or **packages/templates/minimal**.

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

- `<script is:build>` - Runs at build time, has access to `aero.props`, `site` globals, imports
- Plain `<script>` (no `is:*`) - Bundled as virtual module, runs in browser (client)
- `<script is:inline>`, `<script is:blocking>` - See docs/script-taxonomy.md
- `<script src="...">` - External scripts allowed without attributes

### Props System

Props passed via attributes or `props` (and `data-props` for HTML compliance):

```html
<my-component title="{ site.title }" />
<my-component props />
<my-component props="{ ...baseProps }" />
```

Components receive via `aero.props` in `<script is:build>`.

### Path Aliases (tsconfig in app)

- `@components/*` → client/components/\* (or app’s client dir)
- `@layouts/*`, `@pages/*`, `@content/*`, `@styles/*`, `@scripts/*`, `@images/*`, `@src/*`, `@server/*`, `~/*`

## TDD (Test-Driven Development)

Use a **red-to-green** approach: (1) failing test; (2) minimal change to pass; (3) refactor if needed. For bugs, add or adjust a failing test first.

## Development Commands

Run app dev/build/preview from **examples/kitchen-sink** or **packages/templates/minimal** (e.g. `pnpm --dir examples/kitchen-sink dev`). Root: `pnpm test` (Vitest in packages/core), `pnpm build` (packages only).

## File Structure (default app layout)

- `client/pages/` - Route pages (or frontend/ when custom dirs)
- `client/components/`, `client/layouts/`, `client/assets/`
- `content/` - Global data (site.ts, collections)
- `server/api/`, `server/routes/` - Nitro when server: true

## Client Stack

- **Alpine.js** - x-data, x-model, :disabled etc. preserved (not interpolated)
- **HTMX** - hx-post, hx-target etc. passed through
- Alpine attrs match `^(x-|[@:.]).*` and skip `{ }` interpolation

## Gotchas

- Virtual client scripts use `/@aero/client/` prefix; plugin uses `\0` for Vite virtual modules
- Slot passthrough: both `name` and `slot` on `<slot>` elements
- `each` for loops: `<li each="{ item in items }">{ item.name }</li>` (or `data-each`)
