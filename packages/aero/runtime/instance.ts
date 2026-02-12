import { Aero } from '.'
// TODO needs to be dynamic import for user src directory
import site from '@content/site'

declare global {
	var __AERO_INSTANCE__: Aero | undefined
	var __AERO_LISTENERS__: Set<() => void> | undefined
}

const instance = globalThis.__AERO_INSTANCE__ || new Aero()
const listeners = globalThis.__AERO_LISTENERS__ || new Set<() => void>()
const aero = instance

const onUpdate = (cb: () => void) => {
	listeners.add(cb)
	return () => listeners.delete(cb)
}

const notify = () => {
	listeners.forEach((cb: () => void) => cb())
}

if (!globalThis.__AERO_INSTANCE__) {
	globalThis.__AERO_INSTANCE__ = instance
}

if (!globalThis.__AERO_LISTENERS__) {
	globalThis.__AERO_LISTENERS__ = listeners
}

// Auto-register pages, components, and layouts using root-relative globs
const components = import.meta.glob('@components/**/*.html', { eager: true })
const layouts = import.meta.glob('@layouts/*.html', { eager: true })
const pages = import.meta.glob('@pages/**/*.html', { eager: true })

aero.registerPages(components)
aero.registerPages(layouts)
aero.registerPages(pages)

aero.global('site', site)
notify()

if (import.meta.hot) {
	import.meta.hot.accept()
}

export { aero, onUpdate }
