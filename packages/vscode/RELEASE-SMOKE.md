# VS Code extension release smoke checklist

Use this checklist before publishing a new `aero-vscode` version.

## 1) Build and tests

- [ ] From repo root: `pnpm --dir packages/vscode test`
- [ ] From repo root: `pnpm --dir packages/vscode typecheck`
- [ ] Build extension bundle: `pnpm --dir packages/vscode build`

## 2) Install local extension package

- [ ] Produce `.vsix` from repo root (`pnpm run vscode:package`) or package locally with `vsce package --no-dependencies`
- [ ] Install `.vsix` into a clean VS Code profile/workspace

## 3) Core editor behavior

Open a known Aero project and verify:

- [ ] syntax highlighting for `{ ... }` expressions
- [ ] completions for Aero attributes/components
- [ ] go-to-definition for imported components/layouts
- [ ] hover info appears for Aero expressions/usages

## 4) Diagnostics parity checks

Confirm Problems panel shows stable Aero codes and docs links:

- [ ] `AERO_COMPILE` (e.g. malformed directive braces)
- [ ] `AERO_RESOLVE` (missing component import/reference)
- [ ] `AERO_BUILD_SCRIPT` (invalid script taxonomy usage)
- [ ] `AERO_TEMPLATE` / `AERO_SWITCH` warnings (template/switch warnings)
- [ ] `AERO_ROUTE` (route-contract issue, e.g. unsupported route segment like `client/pages/docs/[...slug].html`)

For each diagnostic above:

- [ ] code appears as `AERO_*` in Problems
- [ ] “Learn more” opens the expected docs URL

## 5) Scope/config behavior

- [ ] `aero.scopeMode=auto` behaves correctly in Aero vs non-Aero HTML files
- [ ] `aero.scopeMode=strict` disables features outside detected Aero projects
- [ ] `aero.scopeMode=always` enables features in all HTML files
- [ ] toggling `aero.diagnostics.regexUndefinedVariables` updates diagnostics as expected

## 6) Command behavior

- [ ] Run **Aero: Run check (config, content, templates)** from command palette
- [ ] Verify terminal output and diagnostics mapping are readable

## 7) Packaging sanity

- [ ] `package.json` version/changelog are updated
- [ ] extension icon/assets render correctly
- [ ] no unintended files are included in `.vsix`
