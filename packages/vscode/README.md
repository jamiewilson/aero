# Aero VS Code Extension

Language support for Aero templates in HTML files. Provides syntax highlighting, completions, hovers, definitions, and diagnostics for Aero expressions and components.

## Features

- **Syntax Highlighting:**
  - Highlights Aero expressions in text (`{ props.title }`) and attributes (`title="{ meta.title }"`).
  - Leaves code inside `<script on:build>` and `<script on:client>` blocks unchanged.

- **Completions:**
  - Suggests Aero component names, path aliases, and props in HTML files.
  - Triggered on `<`, `/`, `@`, `"`, and `'`.

- **Hover:**
  - Shows info for Aero expressions, props, and component usage.

- **Definitions:**
  - Jump to component/layout/page definitions via path aliases and imports.

- **Diagnostics:**
  - Warns about invalid Aero expressions, missing props, and template errors.

- **Scope Modes:**
  - `aero.scopeMode` setting controls where features are enabled:
    - `auto` (default): Features run in detected Aero projects and HTML files with Aero markers.
    - `strict`: Features run only in detected Aero projects.
    - `always`: Features run in all HTML files.
  - Project detection checks for Aero path aliases in `tsconfig.json`, Aero dependencies in `package.json`, and Aero-related `vite.config.*` usage.

- **Cache Invalidation:**
  - Automatically clears caches when `tsconfig.json` changes or when `aero.scopeMode` is updated.

## Installation

1. Open VS Code or Cursor.
2. Use **Command Palette** → **Developer: Install Extension from Location**.
3. Select the `vscode` folder.
4. Reload the editor if prompted.

## Usage

Open an Aero template (e.g. `client/pages/about.html`, `client/components/meta.html`).

- Expressions like `{ props.title }` and `{ meta.title }` are highlighted.
- Attributes like `title="{ meta.title }"` show JS highlighting inside quotes.
- Code in `<script on:build>` and `<script on:client>` is left unchanged.
- Completions, hovers, and definitions are available for Aero components and props.
- Diagnostics appear for invalid expressions or missing props.

Plain HTML files without Aero markers do not show Aero-specific features unless `aero.scopeMode` is set to `always`.

## Configuration

In VS Code settings, search for `Aero`:

- `aero.scopeMode`: Controls where Aero features are enabled (`auto`, `strict`, `always`).

## Development

- Main entry: `src/extension.ts`
- Build: `pnpm run build` (uses tsup)
- Test: `pnpm test` (uses Vitest)
