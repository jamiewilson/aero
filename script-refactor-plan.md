# V2 Script Taxonomy Implementation Plan

## Goal Description
Implement the new script taxonomy outlined in [_reference/notes/script-logic.md](file:///Users/jamie/dev/aero/_reference/notes/script-logic.md) where **bundling via Vite and hoisting is the default behavior** for all client `<script>` tags. This model removes the need for `is:bundled` (or the old `on:client`), instead opting in developers to exact platform features natively.

## Proposed Changes

### 1. Parser ([packages/core/src/compiler/parser.ts](file:///Users/jamie/dev/aero/packages/core/src/compiler/parser.ts))
The parser currently only extracts scripts that explicitly contain `is:build`, `is:bundled`, or `is:inline`. It needs a significant rewrite to handle the new defaults:
- **Match all `<script>` tags** using the `linkedom` parser.
- **`is:build`**: Extract and compile as the server-side render function.
- **`is:inline`**: Leave in the template exactly where it is (do not hoist). Do not extract for bundling.
- **`is:blocking`**: Extract from template, flag for `<head>` injection.
- **Default (No `is:*`)**: Extract from template, pass to Vite as a virtual module (`/@aero/client/...`), and flag for hoisting to the end of `<body>`.

### 2. Codegen ([packages/core/src/compiler/codegen.ts](file:///Users/jamie/dev/aero/packages/core/src/compiler/codegen.ts))
Update the code generation to match the parser's new abstract syntax model:
- **Default Scripts (Bundled):** Ensure that when the virtual client script is injected into the root HTML, it **always gets `type="module"`** (unless explicitly omitted by a raw attribute, though modules are safe defaults).
- **Hoisting Sets:** The runtime relies on `Set<string>` (for `scripts` and `styles`) to deduplicate in the layout. We need to introduce a **Head Scripts Set** for `is:blocking` tags so they sit in the `<head>`, while normal scripts remain in `<body>`.

### 3. Vite Plugin ([packages/core/src/vite/index.ts](file:///Users/jamie/dev/aero/packages/core/src/vite/index.ts))
Update how the virtual client server handles `<script>` modules:
- Remove the `is:bundled` string markers and align with the new parser output.
- Pass through exact source scripts (`<script src="...">`) natively, rather than wrapping them if unneeded, but ensure their hoisting resolves correctly.

### 4. Fix `pass:data` Deduping (JSON Bridge)
Currently, `pass:data` generates a unique JSON bridge (`<script type="application/json">`) for every single injected value. Since the runtime deduplicates identical script tags natively via `Set`, rendering a component 3 times with 3 different `pass:data` values generates 3 unique virtual DOM strings that break deduplication.
- **Plan:** Change `pass:data` injection so that the Vite virtual module accepts an array or map of scope variables. E.g., if `<button title="A">` and `<button title="B">` render, the single cached script executes a generic setup function looped over `document.querySelectorAll('[data-aero-props]')` or similar, reading the props locally instead of polluting global scope. 

## Verification Plan

### Automated Tests
- Update `parser.test.ts` to verify all default scripts are captured as client scripts.
- Update `codegen.test.ts` to assert that `is:build` is stripped, `is:inline` remains in DOM order, `is:blocking` goes to head, and defaults go to body with `type="module"`.
- Add integration tests for `pass:data` across multiple component instances.

### Manual Verification
- Run a dev server and check that standard `<script>` tags are HMR-bundled by Vite without any `is:*` syntax needed.
