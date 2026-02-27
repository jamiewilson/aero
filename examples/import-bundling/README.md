# Import and bundling demos

These examples match the five options in [docs/importing-and-bundling.md](../../docs/importing-and-bundling.md). Use them to verify the instructions and to compare bundle size or load behavior.

## Prerequisites

From the **repo root**:

```bash
pnpm install
pnpm run build:core
```

(Or run `pnpm run build` once to build core and config.)

## Running a demo

From the repo root:

```bash
pnpm --dir examples/import-bundling/single-bundle dev
```

Replace `single-bundle` with:

- `single-bundle` — Single bundle (default)
- `cdn-globals` — CDN script tags + globals
- `esm-import-map` — Import map + Vite externals
- `cdn-externals` — Rolldown externals + CDN script tags
- `dynamic-import` — Dynamic import (code-split chunks)

Then open the URL (e.g. http://localhost:5173). Each demo has a page with an **Alpine counter**; if the counter increments when you click the button, that option's setup is working.

## Build and preview

```bash
pnpm --dir examples/import-bundling/single-bundle build
pnpm --dir examples/import-bundling/single-bundle preview
```

## What each demo tests

| Demo            | Doc option        | What to check                                                           |
| --------------- | ----------------- | ----------------------------------------------------------------------- |
| single-bundle    | 1. Single bundle  | One (or few) hashed JS assets; counter works                            |
| cdn-globals     | 2. CDN + globals | Network tab: htmx/Alpine from unpkg; entry smaller; counter works       |
| esm-import-map  | 3. ESM from CDN  | Import map in HTML; externals in build; counter works                   |
| cdn-externals   | 4. Externals     | Script tags + rolldown external; counter works                          |
| dynamic-import  | 5. Dynamic import | Multiple chunks (entry + htmx + alpine); counter works after brief load |
