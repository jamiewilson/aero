# Aero Template Support

Adds Aero template language support inside HTML files.

- **In text:** `<h1>{ props.title } - { props.description }</h1>`
- **In attributes:** `<sub-layout title="{ meta.title }" image="{ meta.image }">`

Expressions inside `<script>` blocks are left unchanged (no double highlighting).

## Scope Modes

The extension exposes `aero.scopeMode` to control where language features run:

- `auto` (default): runs features in detected Aero projects, and in HTML files with strong Aero markers.
- `strict`: runs features only when the current file is inside a detected Aero project.
- `always`: runs features in all HTML files.

Project detection checks nearest folders for Aero signals such as Aero path aliases in `tsconfig.json`, Aero dependencies in `package.json`, and Aero-related `vite.config.*` usage.

## Install from folder

1. In Cursor or VS Code: **Command Palette** → **Developer: Install Extension from Location**
2. Choose the vscode folder (this directory).
3. Reload the editor if prompted.

## Verify

Open an Aero template (e.g. `src/pages/about.html` or `src/components/meta.html`) and confirm:

- Text like `{ props.title }` and `{ meta.title }` show JS highlighting for the expression.
- Attributes like `title="{ meta.title }"` show JS inside the quotes.
- Code in `<script on:build>` (e.g. `const { class: className } = aero.props`) is unchanged.

Also confirm that a plain non-Aero HTML file does not show Aero-specific diagnostics, hovers, definitions, or completions when using `auto` or `strict` mode.
