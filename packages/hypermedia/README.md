# @aero-js/hypermedia

Hypermedia action runner, HTML swap engine, and lifecycle events for Aero. Used when `hypermedia: true` is set in Aero config; composed with the reactivity runtime for post-swap binding processing.

## Overview

- **Actions** — `GET`, `POST`, `PUT`, `PATCH`, `DELETE` with target, swap mode, and loading signals.
- **Swap engine** — Nine swap modes (`innerHTML`, `outerHTML`, `beforebegin`, …).
- **Lifecycle** — `request`, `response`, `swap`, `settle`, and `error` DOM events; phase CSS classes.
- **Process** — Wire `data-aero-on-*` and `data-aero-busy` on swapped fragments.
- **Progressive enhancement** — Compiler emits native `href` / `action` fallbacks for static URLs.

## Install

Enable via Aero config (requires `reactivity: true` for `busy` and signal-aware processing):

```ts
// aero.config.ts
export default defineConfig({
	reactivity: true,
	hypermedia: true,
})
```

Action functions are injected into `on:*` handlers when hypermedia is enabled — no import needed there. Import them in `<script is:state>` when calling from state script code; do not import them in `<script is:build>`.

## Public API

| Export | Description |
| --- | --- |
| `createHypermediaRuntime(options?)` | Runtime with `executeAction`, `swapElement`, `process` |
| `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | Action functions (import in `is:state`; intrinsic in `on:*` handlers) |
| `performSwap`, `resolveTarget`, `parseSwapStyle` | Swap helpers |
| `dispatchLifecycleEvent` | Lifecycle event dispatch |
| `process` | Hypermedia-specific fragment wiring |

Re-exported from `@aero-js/core`:

```ts
import { GET, createHypermediaRuntime } from '@aero-js/hypermedia'
```

## Documentation

User-facing guides:

- [Hypermedia](https://github.com/jamiewilson/aero/blob/main/docs/getting-started/hypermedia.mdx)
- [Hypermedia recipes](https://github.com/jamiewilson/aero/blob/main/docs/guide/hypermedia.mdx)
- [Using hypermedia with reactivity](https://github.com/jamiewilson/aero/blob/main/docs/guide/hypermedia/using-with-reactivity.mdx)

Related:

- [Reactivity](https://github.com/jamiewilson/aero/blob/main/docs/getting-started/reactivity.mdx)
- [Process runtime fragments](https://github.com/jamiewilson/aero/blob/main/docs/guide/reactivity/process.mdx)

## Tests

```bash
pnpm --filter @aero-js/hypermedia test
```
