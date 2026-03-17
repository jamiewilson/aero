# Aero Framework - AI Coding Instructions

## Architecture Overview

Aero is a static site generator with a custom HTML-first template engine. The **framework** lives in **packages/core**; the **example app** used for dev/build is **examples/kitchen-sink**; **packages/create** is the @aero-js/create project initializer (scaffolds from templates). Repo root is the workspace root.

### Monorepo

- **packages/core** - Compiler, runtime, Vite plugin. Built with tsup; used as `@aero-js/core` and `@aero-js/vite`. Run tests from root with `pnpm test` (Vitest in packages/core).
- **packages/vscode** - VS Code extension (syntaxes for Aero templates).
- **packages/create** - Project initializer (@aero-js/create). Run from `packages/create`: `pnpm create @aero-js <name>`; scaffolds into `packages/create/dist/<name>` (gitignored).
- **packages/templates/** - Templates: **minimal** (starter template for @aero-js/create).
- **examples/kitchen-sink** - Full demo app: content collections, Nitro API, Alpine.js, HTMX. Run dev/build/preview from this directory (or `pnpm --dir examples/kitchen-sink dev`); root has no app dev script.
- **Root** - Workspace root. Scripts: `pnpm test` runs core tests; `pnpm build` builds packages only.

### Compilation pipeline (packages/core)

1. **Parser** (packages/core/compiler/parser.ts) extracts `<script is:build>`, client (plain `<script>`), `<script is:inline>`, and `<script is:blocking>` blocks from HTML
2. **Build-script analysis** (packages/core/compiler/build-script-analysis.ts) parses build script content with oxc-parser (JS/TS): extracts imports and `export function getStaticPaths`, returns structured result for codegen
3. **Codegen** (packages/core/compiler/codegen.ts) compiles templates into async render functions with `{ }` interpolation; uses build-script-analysis for build script imports and getStaticPaths
4. **Vite Plugin** (packages/core/vite/index.ts) orchestrates the build, serves pages via middleware, and handles virtual modules for client scripts
5. **Runtime** (packages/core/runtime/index.ts) provides the `Aero` class that renders pages and components with context

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

- `<script is:build>` - Runs at build time; has access to `Aero.props`, `Aero.site` (canonical URL from config), `site` globals (from content), imports. One per template.
- Plain `<script>` (no `is:*`) - Bundled as virtual module, runs in browser (client).
- `<script is:inline>` - Left in place in HTML; not bundled by Vite; runs in browser immediately.
- `<script is:blocking>` - Extracted and emitted in `<head>` (e.g. blocking scripts).
- `<script src="...">` - External scripts allowed without attributes.
- See [docs/script-taxonomy.md](docs/script-taxonomy.md) for full taxonomy.

### Props System

Props passed via attributes or `props`:

```html
<my-component title="{ site.title }" />
<!-- expression -->
<my-component props />
<!-- spreads local `props` var -->
<my-component props="{ ...baseProps }" />
<!-- explicit spread -->
```

Components receive via `Aero.props`:

```html
<script is:build>
	const { title, subtitle } = Aero.props
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
pnpm run dev          # Vite dev server with HMR (Nitro when aero({ server: true }))
pnpm run build        # Static build to dist/; with Nitro also .output/
pnpm run preview      # Static preview only
pnpm run preview:api  # Full server preview (static + API)
pnpm test             # Run Vitest (packages/core compiler + vite tests)
```

## Testing

Tests use Vitest and live in **packages/core**: `compiler/__tests__/` (parser, codegen, vite-plugin), `vite/__tests__/` (build). Run with `pnpm test` from repo root.

## TDD (Test-Driven Development)

Use a **red-to-green** approach for implementing new features or tracking down bugs:

1. **Red**: Write or run a failing test that captures the desired behavior or reproduces the bug. Run the test suite and confirm the test fails.
2. **Green**: Implement the minimal change to make the test pass. Run the test suite and confirm it passes.
3. **Refactor** (if needed): Improve the implementation without changing behavior; keep tests green.

For bug fixes: start by adding or adjusting a test that fails in the current code (red), then fix the code until the test passes (green). Do not skip writing the failing test.

## Client entry and HMR

The recommended client setup is a **single entry** (e.g. `client/assets/scripts/index.ts`) that imports `@aero-js/core` and calls `aero.mount()`. Reference it from the layout with `<script type="module" src="@scripts/index.ts"></script>`. Mount attaches to a root element (default `#app`) and subscribes to updates so that on template or content changes the page re-renders in the browser. HMR for templates and content is **dependency-driven**: the client entry pulls in the runtime instance and its globbed pages/layouts/components, so Vite invalidates the right modules and no custom HMR plugin is needed.

On content routes (e.g. `/docs/*`), HMR re-renders in dev use **fetch** to get HTML from the dev server instead of re-running the full markdown pipeline in the browser, which avoids crashes when DevTools is open. If you still see a tab crash on content pages with DevTools open, close DevTools or avoid having the Elements/Console panel focused during HMR; known browser/DevTools issues can cause memory growth or freezes with the tools open.

## Client Stack Integration

- **Alpine.js** - Attributes like `x-data`, `x-model`, `:disabled` are preserved (not interpolated)
- **HTMX** - Attributes like `hx-post`, `hx-target` are passed through
- Alpine attributes use regex `^(x-|[@:.]).*` to skip `{ }` interpolation

## Configuration (site URL)

Optional `site` (canonical URL, e.g. `{ url: 'https://example.com' }`) can be set in `aero.config.ts` or passed to `aero({ site: { url: '...' } })`. It is exposed as `import.meta.env.SITE` at build time and as `Aero.site.url` in templates. Used for sitemap, RSS, and canonical/Open Graph URLs. See [docs/site-url.md](docs/site-url.md).

- **Environment variables:** Vite’s `import.meta.env`; use `VITE_` prefix for client-exposed vars. Aero injects `SITE` when `site` is set. Optional `env.d.ts` for types. See [docs/environment-variables.md](docs/environment-variables.md).
- **Middleware/hooks:** Optional `middleware` in `aero.config.ts` or `aero({ middleware: [...] })` runs at request time (dev only) for redirects, rewrites, or custom responses. See [\_reference/middleware.md](_reference/middleware.md).

## File Structure

- **examples/kitchen-sink:** Uses custom dirs when configured (e.g. frontend/, backend/, build/); otherwise client/, content/, server/. Run dev/build from this directory.
- **packages/create/** - @aero-js/create initializer (no app source; scaffolds from templates)
- **packages/core/** - Framework (compiler, runtime, Vite plugin; consumed as @aero-js/core and @aero-js/vite)
- **packages/vscode/** - VS Code extension

For a detailed monorepo and packages layout, see [\_reference/guides/monorepo.md](_reference/guides/monorepo.md).

## Documentation (TSDoc)

When adding or refactoring comments in TypeScript files, use **block-style TSDoc** and **standard tags only** (no `@property`—it is not in the TSDoc spec). See [\_reference/tsdoc-guide.md](_reference/tsdoc-guide.md) for the full guide (summary, `@param`/`@returns`/`@remarks`/`@see`/`@example`/`@defaultValue`; describe interface members in prose). The Cursor rule **aero-tsdoc** (`.cursor/rules/aero-tsdoc.mdc`) applies when editing `**/*.ts`. Example: `packages/core/src/types.ts`.

## Gotchas

- Virtual client scripts use `/@aero/client/` prefix - plugin uses `\0` prefix for proper Vite virtual module handling
- Slot passthrough uses both `name` and `slot` attributes on `<slot>` elements
- `each` for loops: `<li each="{ item in items }">{ item.name }</li>`
- All custom attributes (`props`, `each`, `if`, etc.) also accept a `data-` prefix for HTML spec compliance
- `props` on script/style takes one braced expression (same as rest of interpolation); use `props="{ ...theme }"` for object properties as CSS vars, not `{ theme }` (which passes one key). See [docs/interpolation.md](docs/interpolation.md).
