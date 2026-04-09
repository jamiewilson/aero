# Aero VS Code Extension

Language support for Aero templates in HTML files: syntax highlighting, completions, hovers, definitions, and diagnostics for Aero expressions and components.

## Features

- **Syntax highlighting**
  - Aero expressions in text `{ props.title }` and attributes `title="{ meta.title }"`.
  - Code inside `<script is:build>` and client script blocks is left as standard JS/TS.

- **Completions**
  - Aero component names, path aliases, and props in HTML files.
  - Triggered on `<`, `/`, `@`, `"`, and `'`.

- **Hover**
  - Info for Aero expressions, props, and component usage.

- **Definitions**
  - Jump to component/layout/page definitions via path aliases and imports.

- **Diagnostics**
  - Issues use the same **stable codes** as the compiler / CLI (`AERO_COMPILE`, `AERO_RESOLVE`, …) with **links to docs** in the Problems panel.
  - Invalid expressions, missing props, script scopes (`is:build` / client / `is:inline`), and similar template rules.

- **Command palette**
  - **Aero: Run check (config, content, templates)** — runs `aero check` in the workspace (pnpm / yarn / npx depending on lockfiles). This matches the default compile check only; for **TypeScript** validation of build scripts and `{ }` interpolations in CI, use **`aero check --types`** from the terminal (see [CLI](../../docs/tooling/cli.mdx)).

- **Scope mode** (`aero.scopeMode`)
  - `auto` (default) — Features run in detected Aero projects and HTML files with Aero markers.
  - `strict` — Features run only in detected Aero projects.
  - `always` — Features run in all HTML files.
  - Project detection uses Aero path aliases in `tsconfig.json`, Aero deps in `package.json`, and Aero-related `vite.config.*`.

- **Cache invalidation**
  - Caches cleared when `tsconfig.json` changes or `aero.scopeMode` is updated.

- **Emmet**
  - The extension sets **emmet.includeLanguages** so `aero` files use the same Emmet Abbreviations as HTML (expand tags/snippets in templates).

- **TypeScript in templates**
  - **`<script is:build>`** defaults to TypeScript (with `Aero` build ambients). Use **`lang="js"`** or **`lang="javascript"`** for JavaScript-only build scripts. For **client**, **inline**, and **blocking** scripts, add **`lang="ts"`** / **`lang="typescript"`** when you want TypeScript (otherwise they stay JavaScript). Curly interpolations `{ ... }` use small TypeScript virtual fragments that include the same build-scoped bindings as `<script is:build>` so expressions type-check in the editor.

## Installation

1. Open VS Code or Cursor.
2. Search for **Aero** in the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
3. Click Install.

## Repository

The source code for this extension is part of the [Aero Monorepo](https://github.com/jamiewilson/aero). Please file any issues or feature requests on the [GitHub Issues](https://github.com/jamiewilson/aero/issues) page.

## Usage

Open an Aero template (e.g. `client/pages/about.html`, `client/components/meta.html`).

- Expressions like `{ props.title }` and `{ meta.title }` are highlighted.
- Attributes like `title="{ meta.title }"` show JS highlighting inside quotes.
- Code in `<script is:build>` and client `<script>` blocks is left unchanged.
- Completions, hovers, and definitions work for Aero components and props.
- Diagnostics appear for invalid expressions or missing props.

Plain HTML files without Aero markers do not get Aero features unless `aero.scopeMode` is set to `always`.

## Configuration

In VS Code settings, search for **Aero**:

- **aero.scopeMode** — Where Aero features are enabled: `auto`, `strict`, or `always`.

- **aero.diagnostics.regexUndefinedVariables** — Default **`false`**. When **`false`**, the extension does **not** run regex-based “undefined variable inside `{ }`” diagnostics; use the Volar language server and, for CI, **`aero check --types`** for expression typing. Set to **`true`** only if you need that legacy heuristic without relying on the language server.

## Development

- Entry: `src/extension.ts`
- Build: `pnpm run build` (tsup, CJS, `dist/`)
- Test: `pnpm test` (Vitest)
- **Dependencies:** `@aero-js/core/editor`, `@aero-js/html-parser`, `@aero-js/interpolation`, and **`@aero-js/diagnostics`** (`ide-catalog` only for doc URLs; no Effect in the client bundle beyond what core/editor already pulls). Only the `vscode` module is external; the build bundles workspace deps into `dist/`.
- **Publishing:** From the repo root, run `pnpm run vscode:package` to build and produce the `.vsix`. Or from the extension directory: `pnpm install`, `pnpm run build`, then `vsce package --no-dependencies`. Use `--no-dependencies` so vsce skips `npm list` (which fails in pnpm workspaces). The extension bundles deps into `dist/`; the `.vsix` contains only that and assets.
- **Release smoke:** follow [`RELEASE-SMOKE.md`](./RELEASE-SMOKE.md) before publishing to validate editor behavior and diagnostics parity (including `AERO_ROUTE`).
