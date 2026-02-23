/**
 * Client entry for the Aero framework.
 *
 * @remarks
 * Re-exports the shared `aero` instance with a `mount()` method attached.
 * Used as the app's client entry point (e.g. in the main script that runs in the browser).
 * Assumes HTML was server-rendered or pre-rendered; `mount()` does not perform an initial
 * render, only sets up the root element and (in dev) HMR re-renders.
 */

import type { MountOptions } from './types'
import { Aero } from './runtime'
import { aero, onUpdate } from './runtime/instance'
import { renderPage } from './runtime/client'

/** Bound `aero.render` so the same function reference is passed to `renderPage` for HMR re-renders. */
const coreRender = aero.render.bind(aero)

/** Last element passed to `mount()`; used by the HMR callback to re-render the same root. */
let lastEl: HTMLElement
/** Unsubscribe from `onUpdate`. Set once when HMR is active; not cleared (single dev session). */
let unsubscribe: () => void
// TODO: Consider grouping lastEl + unsubscribe into a single HMR state object (or moving to runtime/client) to make the dev pipeline easier to trace.

/**
 * Attach the app to a DOM element and optionally set up HMR re-renders.
 *
 * @remarks
 * Does not perform an initial render: we assume the document already has SSR/pre-rendered
 * HTML. Only runs `onRender` if provided, then in dev (Vite HMR) subscribes to template
 * updates and re-renders into the same target.
 *
 * @param options - Mount options. Defaults to `{ target: '#app' }`.
 * @param options.target - CSS selector (e.g. `#app`) or the root `HTMLElement`. Defaults to `#app`.
 * @param options.onRender - Called with the root element after mount and after each HMR re-render.
 * @returns A promise that resolves immediately. Does not wait for any async render (no initial render).
 * @throws When `target` is a string and no matching element is found in the document.
 */
function mount(options: MountOptions = {}): Promise<void> {
	const { target = '#app', onRender } = options

	const el =
		typeof target === 'string' ? (document.querySelector(target) as HTMLElement) : target

	if (!el) throw new Error('Target element not found: ' + target)

	lastEl = el

	// Skip initial render as we assume SSR provided the correct HTML.
	// We just need to initialize any client-side logic (listeners, hydration, etc.)
	if (onRender) onRender(el)
	const done = Promise.resolve()

	if (import.meta.hot && !unsubscribe) {
		unsubscribe = onUpdate(() => {
			if (lastEl) {
				void renderPage(lastEl, coreRender).then(() => {
					if (onRender) onRender(lastEl)
				})
			}
		})
	}

	return done
}

aero.mount = mount

export default aero as Aero & { mount: typeof mount }
