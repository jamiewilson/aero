# Aero VS Code Extension

[![VS Code Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/aerobuilt.aero-vscode?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=aerobuilt.aero-vscode)
[![VS Code Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/aerobuilt.aero-vscode?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=aerobuilt.aero-vscode)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

Language support for Aero templates in HTML files: syntax highlighting, completions, hovers, definitions, and diagnostics for Aero expressions and components.

## Features

- **Syntax highlighting**
  - Aero expressions in text (`{ props.title }`) and attributes (`title="{ meta.title }"`).
  - Code inside `<script is:build>` and client script blocks is left as standard JS/TS.

- **Completions**
  - Aero component names, path aliases, and props in HTML files.
  - Triggered on `<`, `/`, `@`, `"`, and `'`.

- **Hover**
  - Info for Aero expressions, props, and component usage.

- **Definitions**
  - Jump to component/layout/page definitions via path aliases and imports.

- **Diagnostics**
  - Warnings for invalid Aero expressions, missing props, and template errors (including `pass:data` and script-type scopes).

- **Scope mode** (`aero.scopeMode`)
  - `auto` (default) — Features run in detected Aero projects and HTML files with Aero markers.
  - `strict` — Features run only in detected Aero projects.
  - `always` — Features run in all HTML files.
  - Project detection uses Aero path aliases in `tsconfig.json`, Aero deps in `package.json`, and Aero-related `vite.config.*`.

- **Cache invalidation**
  - Caches cleared when `tsconfig.json` changes or `aero.scopeMode` is updated.

## Installation

1. Open VS Code or Cursor.
2. Search for **Aero** in the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
3. Click Install.

## Repository

The source code for this extension is part of the [Aero Monorepo](https://github.com/aerobuilt/aero). Please file any issues or feature requests on the [GitHub Issues](https://github.com/aerobuilt/aero/issues) page.

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

## Development

- Entry: `src/extension.ts`
- Build: `pnpm run build` (tsup, CJS, `dist/`)
- Test: `pnpm test` (Vitest)
