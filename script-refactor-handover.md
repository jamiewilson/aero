# Aero V2 Script Taxonomy - Handover Document

This document outlines the progress and current state of the V2 Script Taxonomy refactor for the Aero framework.

## Objective
Finalize the script taxonomy to differentiate between:
- `is:build`: Server-side build-time execution (existing).
- `is:inline`: Scripts that stay exactly where they are in the DOM, not bundled or hoisted.
- `is:blocking`: Scripts hoisted to the `<head>` of the document.
- **Default (No attribute)**: Client-side scripts bundled by Vite, hoisted to the end of the `<body>`, and deduplicated.

## Key Changes Made

### 1. Types ([packages/core/src/types.ts](file:///Users/jamie/dev/aero/packages/core/src/types.ts))
- Updated [ParseResult](file:///Users/jamie/dev/aero/packages/core/src/types.ts#37-44) and [CompileOptions](file:///Users/jamie/dev/aero/packages/core/src/types.ts#24-31) to use arrays: `clientScripts`, `inlineScripts`, and `blockingScripts`.
- Added `headScripts: Set<string>` to [AeroRenderInput](file:///Users/jamie/dev/aero/packages/core/src/types.ts#69-79) and [AeroTemplateContext](file:///Users/jamie/dev/aero/packages/core/src/types.ts#80-97).

### 2. Parser ([packages/core/src/compiler/parser.ts](file:///Users/jamie/dev/aero/packages/core/src/compiler/parser.ts))
- Rewrote the parsing logic to extract all scripts and categorize them.
- `is:inline` scripts are now **retained in the template string** rather than extracted into a separate array to be hoisted later.
- Implemented `pass:data` logic for `is:inline` scripts by prepending a dynamic mapping block directly into the tag content in the template:
  ```html
  <script>{ Object.entries(data).map(([k, v]) => "const " + k + " = " + JSON.stringify(v) + ";").join("") }</script>
  ```

### 3. Codegen ([packages/core/src/compiler/codegen.ts](file:///Users/jamie/dev/aero/packages/core/src/compiler/codegen.ts))
- Updated [compile](file:///Users/jamie/dev/aero/packages/core/src/compiler/codegen.ts#539-674) to handle multiple `clientScripts` and `blockingScripts`.
- Implemented hoisting of `blockingScripts` to the `headScripts` set.
- Handled `pass:data` for bundled scripts by injecting a `<script type="application/json" class="__aero_data">` bridge.

### 4. Vite Plugin ([packages/core/src/vite/index.ts](file:///Users/jamie/dev/aero/packages/core/src/vite/index.ts))
- Updated [transform](file:///Users/jamie/dev/aero/packages/core/src/vite/index.ts#218-263) and [load](file:///Users/jamie/dev/aero/packages/core/src/vite/index.ts#192-217) to handle multiple virtual modules per component (e.g., `/@aero/client/Component.0.js`).
- Implemented a registry for `pass:data` virtual modules to ensure that bundled scripts receive their data via the JSON bridge.

### 5. Runtime ([packages/core/src/runtime/index.ts](file:///Users/jamie/dev/aero/packages/core/src/runtime/index.ts))
- Modified the rendering pipeline to initialize `headScripts` and inject them into the final HTML output (usually before `</head>`).

## Current Status & Known Issues

### 🚨 Failing Tests in [codegen.test.ts](file:///Users/jamie/dev/aero/packages/core/src/compiler/__tests__/codegen.test.ts)
The `pass:data` tests for `is:inline` and `is:blocking` are currently failing.

**Reason:**
- In [parser.ts](file:///Users/jamie/dev/aero/packages/core/src/compiler/parser.ts), we rewrite the inline script content to include an interpolation block: `{ Object.entries(...)... }`.
- In [codegen.ts](file:///Users/jamie/dev/aero/packages/core/src/compiler/codegen.ts), the [compileElement](file:///Users/jamie/dev/aero/packages/core/src/compiler/codegen.ts#315-368) function sets `childSkip = true` for `<script>` and `<style>` tags.
- This results in the interpolation block being treated as literal text instead of being compiled into the `__out += ...` logic that would actually execute the mapping.

**Failing Assertions:**
Expected the rendered output to contain `const config = {"theme":"dark"};`, but it contains the literal string `{ Object.entries({ config }).map(...) }`.

## Next Steps for Next Agent
1. **Fix Codegen for Inline Scripts**: Modify [codegen.ts](file:///Users/jamie/dev/aero/packages/core/src/compiler/codegen.ts) (likely in [compileElement](file:///Users/jamie/dev/aero/packages/core/src/compiler/codegen.ts#315-368) or [compileChildNodes](file:///Users/jamie/dev/aero/packages/core/src/compiler/codegen.ts#217-246)) to allow interpolation compilation inside `<script>` and `<style>` tags specifically when they contain `is:inline` or are being processed for `headScripts`.
2. **Verify `pass:data` for Blocking Scripts**: Ensure that the `headScripts` set correctly compiles the mapping logic.
3. **Verify HMR**: Ensure that changes to `pass:data` expressions trigger proper HMR updates in the Vite dev server.
4. **Clean up [codegen.test.ts](file:///Users/jamie/dev/aero/packages/core/src/compiler/__tests__/codegen.test.ts)**: There are some redundant or legacy assertions that could be pruned now that the taxonomy is strictly enforced.

---
*Handover generated on 2026-02-21*
