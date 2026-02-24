# Importing and bundling

Client-side JavaScript in Aero is processed by Vite. How you **import** dependencies (e.g. htmx, Alpine.js, or your own modules) determines whether they are **bundled** into your entry chunk, loaded from the network (CDN), or split into separate chunks. This guide explains the options and tradeoffs.

See [Script taxonomy](script-taxonomy.md) for the different script types (`is:build`, plain `<script>`, `is:inline`, `src="..."`) and [HTMX and Alpine](htmx-and-alpine.md) for setup patterns with those libraries.

## How client scripts are bundled

- **Plain `<script>`** (no `is:*`) and **`<script src="@scripts/...">`** are both handled by Vite.
- Plain `<script>` body is turned into a virtual module; `src` to a local path is treated as an **entry point**. In both cases, every **ES module import** in that file is followed by Vite and inlined (or chunked) into the build output.
- So if your entry does `import htmx from 'htmx.org'` and `import Alpine from 'alpinejs'`, the entire htmx and Alpine libraries are bundled into the same output file (or a small set of chunks) by default.

That single-bundle behavior is normal and correct for many apps. Whether you want to change it depends on your goals (smaller initial bundle, CDN caching, parallel loading, etc.).

## Option 1: Single bundle (default)

Demo: [examples/single-bundle](../examples/single-bundle) — `pnpm --dir examples/single-bundle dev`

**What you do:** Import everything in your client entry (e.g. `client/assets/scripts/index.ts`):

```typescript
import aero from '@aero-ssg/core'
import htmx from 'htmx.org'
import Alpine from '@scripts/alpine'

htmx.config.globalViewTransitions = true
htmx.onLoad(node => Alpine.initTree(node as HTMLElement))

aero.mount({
	target: '#app',
	onRender(el) {
		htmx.process(el)
		Alpine.initTree(el)
	},
})
```

**Result:** One (or a few) hashed asset files. All of Aero runtime, htmx, Alpine, and your app code in one download.

| Pros                                           | Cons                                                   |
| ---------------------------------------------- | ------------------------------------------------------ |
| Single request, simple deployment              | Larger initial JS; no CDN caching for third-party libs |
| Tree-shaking possible for libs that support it |                                                        |
| No ordering or global-variable concerns        |                                                        |

**When to use:** When you prefer simplicity and are fine with the total bundle size.

---

## Option 2: Load from the page (CDN or static), use globals

Demo: [examples/cdn-globals](../examples/cdn-globals) — `pnpm --dir examples/cdn-globals dev`

**What you do:** Do **not** import htmx or Alpine in your client entry. Instead:

1. In your layout (e.g. `base.html`), add `<script>` tags **before** your entry script so htmx and Alpine are available as globals:

```html
<link rel="stylesheet" href="@styles/global.css" />
<script src="https://unpkg.com/htmx.org@2.0.8" defer></script>
<script src="https://unpkg.com/alpinejs@3.15.8" defer></script>
<script type="module" src="@scripts/index.ts"></script>
```

2. In your entry, use the globals and optionally type them:

```typescript
import aero from '@aero-ssg/core'

declare global {
	var htmx: typeof import('htmx.org').default
	var Alpine: import('alpinejs').Alpine
}

htmx.config.globalViewTransitions = true
htmx.onLoad(node => Alpine.initTree(node as HTMLElement))

aero.mount({
	target: '#app',
	onRender(el: HTMLElement) {
		htmx.process(el)
		Alpine.initTree(el)
	},
})
```

If you use Alpine plugins (e.g. persist) or stores, add their script tags before your entry and extend the `declare global` block; or configure them in an **inline** script after Alpine so they run before your entry.

**Result:** Your entry bundle contains only Aero and your app code. htmx and Alpine are loaded separately and can be cached by the browser/CDN.

| Pros                                        | Cons                                                        |
| ------------------------------------------- | ----------------------------------------------------------- |
| Smaller custom bundle; CDN caching for libs | Two (or more) script requests; must manage load order       |
| Clear split between “vendor” and “app”      | Plugins/stores may need inline script or extra small module |
| No bundling of those libs                   |                                                             |

**When to use:** When you want smaller first-load JS and good cache reuse for htmx/Alpine.

---

## Option 3: ESM from CDN (import map or external URL)

Demo: [examples/esm-import-map](../examples/esm-import-map) — `pnpm --dir examples/esm-import-map dev`

Many libraries ship an **ESM build** on the CDN (e.g. Alpine's `module.esm.min.js`:  
`https://unpkg.com/alpinejs@3.15.8/dist/module.esm.min.js`). Using that instead of the UMD/IIFE build gives you:

- **CDN caching** and **no bundling** of the lib (same benefit as Option 2).
- **Native ESM**: the browser loads a real module (import/export), not a script that attaches a global.
- **Same code style**: your entry can keep `import Alpine from 'alpinejs'`; the browser resolves it via an import map or the built output imports from the CDN URL.

**Ways to use it:**

1. **Import map (recommended)**
   - Mark `htmx.org` and `alpinejs` as **external** in Vite so the built entry keeps those imports and does not bundle them. Use `aero.config.ts` with `createViteConfig(aeroConfig)` in `vite.config.ts`:

```typescript
// aero.config.ts
import { defineConfig } from '@aero-ssg/config'

export default defineConfig({
	vite: {
		build: {
			rolldownOptions: {
				external: ['htmx.org', 'alpinejs'],
			},
		},
	},
})
```

   - In your layout, add an import map before your entry:

```html
<link rel="stylesheet" href="@styles/global.css" />
<script type="importmap">
	{
		"imports": {
			"htmx.org": "https://unpkg.com/htmx.org@2.0.8/dist/htmx.esm.js",
			"alpinejs": "https://unpkg.com/alpinejs@3.15.8/dist/module.esm.min.js"
		}
	}
</script>
<script type="module" src="@scripts/index.ts"></script>
```

   - In your entry, use normal imports. Because Alpine's ESM build does not auto-start, call `Alpine.start()` before configuring htmx:

```typescript
import aero from '@aero-ssg/core'
import htmx from 'htmx.org'
import Alpine from 'alpinejs'

Alpine.start()
htmx.config.globalViewTransitions = true
htmx.onLoad(node => Alpine.initTree(node as HTMLElement))

aero.mount({
	target: '#app',
	onRender(el) {
		htmx.process(el)
		Alpine.initTree(el)
	},
})
```

2. **External with full URL**
   - Configure the build so the emitted code is `import Alpine from 'https://unpkg.com/alpinejs@3.15.8/dist/module.esm.min.js'` (e.g. Rollup `external` plus a resolve that rewrites the specifier to the URL, or a small plugin). No import map needed; the URL is in the bundle. Version updates require a config change.

**When to use:** When the lib provides an ESM CDN build and you want CDN caching, no bundling of that lib, and to keep using `import` in your code. Prefer the import map approach so the CDN URL (and version) live in HTML, not in the build config.

---

## Option 4: Externals (don’t bundle, expect globals)

Demo: [examples/cdn-externals](../examples/cdn-externals) — `pnpm --dir examples/cdn-externals dev`

**What you do:** Tell Vite **not** to bundle htmx and Alpine by marking them as externals. The built output will expect them as globals at runtime, so you load them via `<script>` in the layout (as in Option 2) and use the globals in your entry. Set `vite.build.rolldownOptions.external` in `aero.config.ts` and use `createViteConfig(aeroConfig)` in `vite.config.ts`.

**1. Mark packages as external in `aero.config.ts`:**

```typescript
// aero.config.ts
import { defineConfig } from '@aero-ssg/config'

export default defineConfig({
	vite: {
		build: {
			rolldownOptions: {
				external: ['htmx.org', 'alpinejs'],
			},
		},
	},
})
```

**2. Load the libraries in your layout so they attach to the window (before your entry):**

```html
<link rel="stylesheet" href="@styles/global.css" />
<script src="https://unpkg.com/htmx.org@2.0.8" defer></script>
<script src="https://unpkg.com/alpinejs@3.15.8" defer></script>
<script type="module" src="@scripts/index.ts"></script>
```

**3. In your client entry, use the globals and type them:**

```typescript
// client/assets/scripts/index.ts
import aero from '@aero-ssg/core'

declare global {
	var htmx: typeof import('htmx.org').default
	var Alpine: import('alpinejs').Alpine
}

htmx.config.globalViewTransitions = true
htmx.onLoad(node => Alpine.initTree(node as HTMLElement))

aero.mount({
	target: '#app',
	onRender(el: HTMLElement) {
		htmx.process(el)
		Alpine.initTree(el)
	},
})
```

You can keep `import htmx from 'htmx.org'` and `import Alpine from 'alpinejs'` in the entry if you add a small Vite plugin that resolves those ids to a virtual module that re-exports `window.htmx` / `window.Alpine`; otherwise, use the globals directly as above so the emitted bundle does not contain unresolved imports.

**Result:** Smaller main bundle; htmx and Alpine are not inlined. Same “load via script tags” requirement as Option 2.

| Pros                                         | Cons                                                 |
| -------------------------------------------- | ---------------------------------------------------- |
| Smaller bundle; imports still work for types | Config and (if needed) shims are more involved       |
|                                              | You still ship or reference the libs via script tags |

**When to use:** When you want to avoid bundling these deps but keep using them via imports (e.g. for TypeScript) and are willing to maintain Vite config and load order.

---

## Option 5: Code-splitting with dynamic import()

Demo: [examples/dynamic-import](../examples/dynamic-import) — `pnpm --dir examples/dynamic-import dev`

**What you do:** Keep imports, but load heavy libs asynchronously so Vite can put them in separate chunks (e.g. with top-level `await import()`):

```typescript
import aero from '@aero-ssg/core'

const htmx = (await import('htmx.org')).default
const Alpine = (await import('@scripts/alpine')).default

htmx.config.globalViewTransitions = true
htmx.onLoad(node => Alpine.initTree(node as HTMLElement))

aero.mount({
	target: '#app',
	onRender(el) {
		htmx.process(el)
		Alpine.initTree(el)
	},
})
```

**Result:** The main entry chunk is smaller; htmx and Alpine are in separate hashed chunks and loaded when the entry runs. They are still bundled by Vite, not loaded from a CDN (unless you also configure that).

| Pros                                           | Cons                                      |
| ---------------------------------------------- | ----------------------------------------- |
| Smaller initial bundle; no script-tag ordering | Extra round-trips for the lazy chunks     |
| No change to HTML; all deps still in repo      | Libs still bundled, not CDN               |
| Same code style (imports)                      | Slight delay before htmx/Alpine are ready |

**When to use:** When you want a smaller first load and are okay with bundled, lazy-loaded libs.

---

| Approach              | Bundled?                | Loaded how?                          | Best when                              |
| --------------------- | ----------------------- | ------------------------------------ | -------------------------------------- |
| **1. Single bundle**  | Yes, everything         | One (or few) entry chunks            | Simplicity, one request                |
| **2. CDN + globals**  | No (htmx/Alpine)        | Script tags then entry               | Smaller app bundle, CDN cache          |
| **3. ESM from CDN**   | No (that lib)           | Import map or external URL → CDN ESM | CDN + no bundle + keep `import` syntax |
| **4. Externals**      | No (marked external)    | Script tags then entry               | Same as 2, with import-style typing    |
| **5. Dynamic import** | Yes, in separate chunks | Entry then lazy chunks               | Smaller initial chunk, no HTML changes |

In all cases, your **Aero runtime** and app code stay in the client entry (or its chunks). The only difference is whether htmx and Alpine are bundled with it, loaded from the page, or split into lazy-loaded bundles.

## Demos

Runnable demos for each option live in the repo under `examples/`. From the repo root, install once (`pnpm install`), then run or build any demo:

- **Option 1:** `pnpm --dir examples/single-bundle dev` (or `build` / `preview`)
- **Option 2:** `pnpm --dir examples/cdn-globals dev`
- **Option 3:** `pnpm --dir examples/esm-import-map dev`
- **Option 4:** `pnpm --dir examples/cdn-externals dev`
- **Option 5:** `pnpm --dir examples/dynamic-import dev`

Each demo has a single page with an Alpine counter; if the counter works, that option’s setup is valid. See `examples/README.md` for more.
