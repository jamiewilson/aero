import { TBD } from '@src/runtime'
import site from '~/data/site'

declare global {
	var __TBD_INSTANCE__: TBD | undefined
	var __TBD_LISTENERS__: Set<() => void> | undefined
}

const instance = globalThis.__TBD_INSTANCE__ || new TBD()
const listeners = globalThis.__TBD_LISTENERS__ || new Set<() => void>()
const tbd = instance

const onUpdate = (cb: () => void) => {
	listeners.add(cb)
	return () => listeners.delete(cb)
}

const notify = () => {
	listeners.forEach((cb: () => void) => cb())
}

if (!globalThis.__TBD_INSTANCE__) {
	globalThis.__TBD_INSTANCE__ = instance
}

if (!globalThis.__TBD_LISTENERS__) {
	globalThis.__TBD_LISTENERS__ = listeners
}

// Auto-register pages, components, and layouts using root-relative globs
const components = import.meta.glob('@components/*.html', { eager: true })
const layouts = import.meta.glob('@layouts/*.html', { eager: true })
const pages = import.meta.glob('@pages/*.html', { eager: true })

tbd.registerPages(components)
tbd.registerPages(layouts)
tbd.registerPages(pages)

tbd.global('site', site)
notify()

if (import.meta.hot) {
	import.meta.hot.accept()
}

export { tbd, onUpdate }
