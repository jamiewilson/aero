# aero-lume

Built with [Aero](https://github.com/aerobuilt/aero) — an HTML-first static site generator powered by Vite.

## Commands

| Command        | Description            |
| -------------- | ---------------------- |
| `pnpm dev`     | Start the dev server   |
| `pnpm build`   | Build for production   |
| `pnpm preview` | Preview the built site |

## Project Structure

```
aero-lume/
├── client/
│   ├── assets/         # Styles, scripts, images
│   ├── components/     # Reusable .html components
│   ├── layouts/        # Layout wrappers with <slot>
│   └── pages/          # File-based routing
├── content/
│   └── site.ts         # Global site data
├── public/             # Static assets (copied as-is)
├── vite.config.ts      # Aero Vite plugin
└── tsconfig.json       # Path aliases
```

## Learn More

- [Aero on GitHub](https://github.com/aerobuilt/aero)
- [aerobuilt on npm](https://www.npmjs.com/package/aerobuilt)

# Using Lume.js with Aero

This guide explains how to use [Lume.js](https://github.com/sathvikc/lume-js) for reactive state management in Aero apps. Lume is a minimal, standards-based reactivity library (~2.4KB) that uses plain `data-*` attributes—no custom syntax and no build step. It fits Aero’s HTML-first approach and works alongside Aero’s build-time templates.

## How Aero and Lume differ

| Concern          | Aero                                                                                                                       | Lume                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **When**         | Build / SSR (and client re-render on HMR)                                                                                  | Browser only, after HTML is in the DOM                                             |
| **Conditionals** | `if` / `data-if` with `{ expression }` — expression runs at **render time** (build context: `aero.props`, `site`, globals) | `data-show="key"` — show/hide based on **reactive store** in the browser           |
| **Data**         | Template context (props, content, globals)                                                                                 | `state({ ... })` + `bindDom(root, store)`                                          |
| **Attributes**   | Directives like `if`, `each`, `props` are compiled away                                                                    | `data-bind`, `data-show`, etc. are left in HTML and interpreted by Lume at runtime |

**Important:** Aero’s `if` is **not** reactive. The condition is evaluated once when the template runs (at build or when the client re-renders for HMR). There is no `store` in Aero’s template context unless you pass it as a prop or global. So for **client-driven** visibility (e.g. “show header when `store.name` is set”), use **Lume’s attributes**, not Aero’s `if`.

---

## Recommended approach: Lume for client reactivity

1. **Aero** outputs HTML that includes Lume’s `data-*` attributes.
2. **Client entry** creates the Lume store and calls `bindDom(appEl, store)` (and re-binds after HMR in `onRender`).
3. **Initial state** can be seeded from Aero via `pass:data` so the first paint and Lume stay in sync.

---

## Setup

### 1. Install Lume

```bash
pnpm add lume-js
```

**Package exports and versions:** The `lume-js/handlers` subpath (e.g. `import { show } from 'lume-js/handlers'`) is **only exported in 2.0.0-beta.1 and later** (e.g. `lume-js@next`). In **2.0.0-alpha.x** and **1.x**, the package does not export `./handlers`, so that import fails. Either upgrade to a version that exports handlers (e.g. `pnpm add lume-js@next`) or use **Option B** in [Conditional header](#conditional-header-show-h1-when-storename-is-set) (implementing show with `effect`).

### 2. Create the store and bind in the client entry

Your app has a single client entry (e.g. `client/assets/scripts/index.ts`) that imports `aerobuilt` and calls `aero.mount()`. Create the Lume store there and pass it to `bindDom` so it’s available after the initial paint and after every HMR re-render.

**Example (minimal):**

```ts
// e.g. client/assets/scripts/index.ts
import aero from 'aerobuilt'
import { state, bindDom } from 'lume-js'

const store = state({ name: '' })

aero.mount({
	target: '#app',
	onRender(el) {
		bindDom(el, store)
	},
})
```

If you use other client libs (e.g. HTMX, Alpine), run them in the same `onRender` so they and Lume all see the current DOM. If your Lume version exports `lume-js/handlers`, you can add the `show` handler for `data-show` (see [Conditional header](#conditional-header-show-h1-when-storename-is-set) below).

---

## Conditional header: “Show &lt;h1&gt; when store.name is set”

**Goal:** Show a header only when `store.name` is truthy, and have it update reactively when the user changes the name.

**Do not use** Aero’s `if` for this. At build time there is no `store`; the condition would be wrong or undefined.

**Do:** Output the element with a visibility attribute and bind the same root with your store. Two options:

**Option A — When `lume-js/handlers` is available (2.0.0-beta.1+):** Use `data-show="name"` and register the `show` handler:

```html
<h1 data-show="name">
	Hello,
	<span data-bind="name"></span>
	!
</h1>
<input data-bind="name" placeholder="Enter your name" />
```

```ts
import { state, bindDom } from 'lume-js'
import { show } from 'lume-js/handlers'

const store = state({ name: '' })
aero.mount({
	target: '#app',
	onRender(el) {
		bindDom(el, store, { handlers: [show] })
	},
})
```

**Option B — When `lume-js/handlers` is not exported (e.g. 2.0.0-alpha.x):** Use the same HTML with `data-show="name"` and implement show with `effect` so the element’s `hidden` property tracks the store key. Run this after `bindDom` in `onRender`:

```html
<h1 data-show="name">
	Hello,
	<span data-bind="name"></span>
	!
</h1>
<input data-bind="name" placeholder="Enter your name" />
```

```ts
import aero from 'aerobuilt'
import { state, bindDom, effect } from 'lume-js'

const store = state({ name: '' })

/** Use when lume-js/handlers is not available (e.g. 2.0.0-alpha). */
function bindShow(root: HTMLElement) {
	root.querySelectorAll('[data-show]').forEach(el => {
		const key = (el as HTMLElement).getAttribute('data-show')
		if (!key || !(key in store)) return
		effect(() => {
			;(el as HTMLElement).hidden = !(store as Record<string, unknown>)[key]
		})
	})
}

aero.mount({
	target: '#app',
	onRender(el) {
		bindDom(el, store)
		bindShow(el)
	},
})
```

In both cases, the `<span>` and `<input>` stay in sync with `store.name` via `data-bind`.

---

## Passing initial state from Aero to Lume (pass:data)

You can seed the Lume store from build-time data so the first HTML and client state match (e.g. theme, user name from content).

**Template:**

```html
<script is:build>
	import site from '@content/site'
	const initialName = site?.userName ?? ''
</script>

<div id="app">
	<h1 data-show="name">
		Hello,
		<span data-bind="name"></span>
		!
	</h1>
	<input data-bind="name" placeholder="Enter your name" />
</div>

<script pass:data="{ initialName }">
	import aero from 'aerobuilt'
	import { state, bindDom } from 'lume-js'

	const store = state({ name: initialName })
	aero.mount({
		target: '#app',
		onRender(el) {
			bindDom(el, store)
		},
	})
</script>
```

Here the **client script is in the template** and uses `pass:data`. Alternatively, keep the client entry in a separate module and inject initial state via a JSON script tag (Aero’s standard pattern for pass:data with plain `<script>` modules); then in the entry, read that data and create `state({ name: initialName })` before `bindDom`.

---

## Other common patterns

### Buttons and boolean state (e.g. menu open/closed)

Use Lume’s built-in or handler attributes; no Aero `if` needed.

```html
<button data-aria-expanded="menuOpen" data-bind="menuOpen">Menu</button>
<div data-aria-hidden="menuOpen">Panel content</div>
```

Or with the `show` handler (when `lume-js/handlers` is available):

```html
<button type="button">Toggle menu</button>
<div data-show="menuOpen">Panel content</div>
```

In the client, define `store.menuOpen` and wire the button to toggle it (e.g. `onclick` that sets `store.menuOpen = !store.menuOpen`, or use a small effect/listener). Lume’s handlers only bind attributes to state; you still attach events in JS or use another library.

### Form fields (two-way binding)

Lume’s `data-bind` gives two-way binding for inputs and one-way for text nodes.

```html
<input data-bind="email" type="email" placeholder="Email" />
<div data-bind="email"></div>
```

Store: `state({ email: '' })`. No Aero directives needed.

### Toggling CSS classes

Use the `classToggle` handler (requires `lume-js/handlers`, e.g. 2.0.0-beta.1+):

```ts
import { classToggle } from 'lume-js/handlers'
bindDom(el, store, { handlers: [classToggle('active')] })
```

```html
<div data-class-active="isActive">Active when isActive is true</div>
```

### Setting string attributes (e.g. links)

Use the `stringAttr` handler (requires `lume-js/handlers`, e.g. 2.0.0-beta.1+):

```ts
import { stringAttr } from 'lume-js/handlers'
bindDom(el, store, { handlers: [stringAttr('href')] })
```

```html
<a data-href="profileUrl">Profile</a>
```

Store: `state({ profileUrl: '/user/alice' })`.

### Lists (reactive arrays)

- **Build-time list:** Use Aero’s `each` to render a list from build/content data. You can still put `data-bind` or other Lume attributes on the repeated elements if you’re binding to a single store key (e.g. selected id).
- **Client-only reactive list:** Lume’s **addon** `repeat(container, store, key, options)` can render a keyed list from a store key. Use it from your client entry after `bindDom`, or in an `effect` that runs when the store key changes. This is the right tool when the list itself is dynamic in the browser.

### Disabled / loading states

Use Lume’s **built-in** boolean attributes (no handlers package needed):

```html
<button data-disabled="isSubmitting">Submit</button>
<div data-hidden="isLoading">Content</div>
```

Store: `state({ isSubmitting: false, isLoading: false })`.

---

## When to use Aero’s `if` vs Lume

- **Use Aero’s `if` / `data-if`** when the condition depends only on **build-time or SSR context**: `aero.props`, content, globals, `site`. Example: “show a promo block only when `site.featureFlags.promo` is true.”
- **Use Lume’s `data-show` (or similar)** when the condition depends on **client state** that changes after load: “show header when `store.name` is set,” “show panel when `store.menuOpen` is true.”

You can combine both: e.g. Aero’s `if` to include a whole section only for certain routes or flags, and inside that section use Lume attributes for fine-grained reactivity.

---

## HMR and re-binding

Aero’s client entry runs `onRender(el)` after each HMR-driven re-render. Because the DOM is replaced, you **must** call `bindDom(el, store)` inside `onRender` so Lume re-attaches to the new nodes. The same applies to any other client library (HTMX, Alpine) that needs to re-run on the new body. Keeping a single `onRender` that runs Lume + others keeps behavior correct after hot reloads.

---

## Summary

| Need                                                             | Use                                                                                             |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Conditional visibility from **client** state (e.g. `store.name`) | Lume: `data-show="name"` + `show` handler (beta.1+) or Option B `effect` workaround (alpha/1.x) |
| Conditional visibility from **build** context (props, content)   | Aero: `if="{ expression }"`                                                                     |
| Two-way / one-way form binding                                   | Lume: `data-bind="key"`                                                                         |
| Toggle classes, ARIA, string attrs                               | Lume handlers: `classToggle`, `ariaAttr`, `stringAttr`                                          |
| Initial state from Aero → Lume                                   | `pass:data` (or JSON script tag) and create store with that data before `bindDom`               |
| Re-binding after HMR                                             | Call `bindDom(el, store)` (and any other init) in `aero.mount({ onRender(el) { ... } })`        |

This keeps Aero responsible for structure and build-time data, and Lume for browser-only reactivity, with a clear split and no conflict between the two.
