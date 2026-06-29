# @aero-js/reactivity

Client-side signal store, DOM bindings, and fragment processing for Aero templates. Used when `reactivity: true` is set in Aero config; wired through `@aero-js/core` at client mount.

## Overview

- **Signals** — `let` bindings in `<script is:state>` become reactive values in a `SignalStore`.
- **Bindings** — Text, events, `show`, `html`, `class:*`, properties, and form model attributes.
- **Structural** — Reactive `if` / `for` / `switch` reconciliation with keyed list support.
- **Process** — Mount bindings on HTML inserted after initial page load (hypermedia swaps or imperative `innerHTML`).

## Install

Apps enable reactivity via Aero config, not by installing this package directly:

```ts
// aero.config.ts
export default defineConfig({ reactivity: true })
```

The core client entry bootstraps the runtime and exposes `aero.getReactivityRuntime()`.

## Public API

| Export | Description |
| --- | --- |
| `createReactivityRuntime(options?)` | Create a standalone runtime with optional `initialState` and `hydrationRoot` |
| `Signal`, `Computed`, `Effect`, `SignalStore` | Primitives for advanced or programmatic use |
| `mountStateBindings`, `bindEvent`, `bindText`, … | Low-level binding helpers (used by compiler output) |
| `AeroReactivity`, `processFragment` | Fragment processing API |

Re-exported from `@aero-js/core`:

```ts
import { createReactivityRuntime } from '@aero-js/core/reactivity'
```

## Documentation

User-facing guides:

- [Reactivity](https://github.com/jamiewilson/aero/blob/main/docs/getting-started/reactivity.mdx)
- [Reactivity recipes](https://github.com/jamiewilson/aero/blob/main/docs/guide/reactivity.mdx)
- [Reactive bindings](https://github.com/jamiewilson/aero/blob/main/docs/guide/reactivity/bindings.mdx)
- [Structural reactivity](https://github.com/jamiewilson/aero/blob/main/docs/guide/reactivity/structural.mdx)
- [Reactive props](https://github.com/jamiewilson/aero/blob/main/docs/guide/reactivity/reactive-props.mdx)
- [Process runtime fragments](https://github.com/jamiewilson/aero/blob/main/docs/guide/reactivity/process.mdx)

## Tests

```bash
pnpm --filter @aero-js/reactivity test
```
