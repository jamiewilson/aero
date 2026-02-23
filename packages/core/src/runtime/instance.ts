/**
 * Singleton Aero instance and HMR update subscription.
 *
 * @remarks
 * Provides a single shared `Aero` instance and a listener set so the client entry can subscribe to
 * "something changed" (e.g. template or glob updates). Uses `globalThis` so the instance survives
 * Vite HMR re-execution. On load, runs Vite-specific `import.meta.glob` for pages, components, and
 * layouts, registers them with the instance, then calls `notify()` so any existing subscribers
 * (e.g. the client `mount()` HMR callback) can re-render. Only used in a Vite app context.
 */

import { Aero } from '.'

/** Global slot for the singleton Aero instance; used so HMR re-execution reuses the same instance. */
declare global {
	var __AERO_INSTANCE__: Aero | undefined
	var __AERO_LISTENERS__: Set<() => void> | undefined
}

const instance = globalThis.__AERO_INSTANCE__ || new Aero()
const listeners = globalThis.__AERO_LISTENERS__ || new Set<() => void>()
const aero = instance

/**
 * Subscribe to update notifications (e.g. after globs or templates change).
 * Used by the client entry to re-render on HMR.
 *
 * @param cb - Callback invoked when `notify()` runs (e.g. after this module re-executes).
 * @returns Unsubscribe function that removes `cb` from the listener set.
 */
const onUpdate = (cb: () => void) => {
	listeners.add(cb)
	return () => listeners.delete(cb)
}

/** Invoke all registered listeners. Called once after `registerPages` on load and after HMR re-run. */
const notify = () => {
	listeners.forEach((cb: () => void) => cb())
}

if (!globalThis.__AERO_INSTANCE__) {
	globalThis.__AERO_INSTANCE__ = instance
}

if (!globalThis.__AERO_LISTENERS__) {
	globalThis.__AERO_LISTENERS__ = listeners
}

/** Eager globs so pages, layouts, and components are available synchronously for SSR/build. */
const components = import.meta.glob('@components/**/*.html', { eager: true })
const layouts = import.meta.glob('@layouts/*.html', { eager: true })
const pages = import.meta.glob('@pages/**/*.html', { eager: true })

aero.registerPages(components)
aero.registerPages(layouts)
aero.registerPages(pages)

notify()

if (import.meta.hot) {
	import.meta.hot.accept()
}

export { aero, onUpdate }
