# TBD Template Syntax Highlighting

Adds JavaScript syntax highlighting for TBD template expressions `{ ... }` in HTML files.

- **In text:** `<h1>{ props.title } - { props.description }</h1>`
- **In attributes:** `<sub-layout title="{ meta.title }" image="{ meta.image }">`

Expressions inside `<script>` blocks are left unchanged (no double highlighting).

## Install from folder

1. In Cursor or VS Code: **Command Palette** → **Developer: Install Extension from Location**
2. Choose the `vscode-tbd-grammar` folder (this directory).
3. Reload the editor if prompted.

## Verify

Open a TBD template (e.g. `client/pages/about.html` or `client/components/meta.html`) and confirm:

- Text like `{ props.title }` and `{ meta.title }` show JS highlighting for the expression.
- Attributes like `title="{ meta.title }"` show JS inside the quotes.
- Code in `<script on:build>` (e.g. `const { class: className } = tbd.props`) is unchanged.
