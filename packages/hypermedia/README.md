# @aero-js/hypermedia

Hypermedia action runner, HTML swap engine, and lifecycle events for Aero. Used when `hypermedia: true` is set in Aero config; composed with the reactivity runtime for post-swap binding adoption.

## Overview

- **Actions** — `GET`, `POST`, `PUT`, `PATCH`, `DELETE` with target, swap mode, and loading signals.
- **Swap engine** — Nine swap modes (`innerHTML`, `outerHTML`, `beforebegin`, …).
- **Lifecycle** — `request`, `response`, `swap`, `settle`, and `error` DOM events; phase CSS classes.
- **Adopt** — Wire `data-aero-on-*` and `data-aero-busy` on swapped fragments.
- **Progressive enhancement** — Compiler emits native `href` / `action` fallbacks for static URLs.

## Install

Enable via Aero config (requires `reactivity: true` for `busy` and signal-aware adoption):

```ts
// aero.config.ts
export default defineConfig({
	reactivity: true,
	hypermedia: true,
})
```

Action functions are injected into `<script is:state>` mount scope — no manual import in templates.

## Public API

| Export | Description |
| --- | --- |
| `createHypermediaRuntime(options?)` | Runtime with `executeAction`, `swapElement`, `adopt` |
| `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | Action functions (also available in template state scope) |
| `performSwap`, `resolveTarget`, `parseSwapStyle` | Swap helpers |
| `dispatchLifecycleEvent` | Lifecycle event dispatch |
| `adopt` | Hypermedia-specific fragment wiring |

Re-exported from `@aero-js/core`:

```ts
import { GET, createHypermediaRuntime } from '@aero-js/core/hypermedia'
```

## Documentation

User-facing guide: [Hypermedia actions](https://github.com/jamiewilson/aero/blob/main/docs/guide/hypermedia.mdx)

Related:

- [Reactivity](https://github.com/jamiewilson/aero/blob/main/docs/guide/reactivity.mdx)
- [Adopt runtime fragments](https://github.com/jamiewilson/aero/blob/main/docs/guide/reactivity/adopt.mdx)

## Tests

```bash
pnpm --filter @aero-js/hypermedia test
```
