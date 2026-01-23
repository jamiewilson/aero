import { TBD } from './index'
import { site } from '~/data/site'

// Use a global singleton to persist across HMR updates
const globalTBD = (globalThis as any).__TBD_INSTANCE__ || new TBD()
if (!(globalThis as any).__TBD_INSTANCE__) {
	;(globalThis as any).__TBD_INSTANCE__ = globalTBD
}

export const tbd = globalTBD
tbd.global('site', site)

// Setup a listener system for HMR re-renders
const listeners = (globalThis as any).__TBD_LISTENERS__ || new Set<() => void>()
if (!(globalThis as any).__TBD_LISTENERS__) {
	;(globalThis as any).__TBD_LISTENERS__ = listeners
}

export const onUpdate = (cb: () => void) => {
	listeners.add(cb)
	return () => listeners.delete(cb)
}

const notify = () => {
	listeners.forEach((cb: () => void) => cb())
}

// Auto-register pages, components, and layouts using Vite's glob
const components = import.meta.glob('@/components/*.html', { eager: true })
const layouts = import.meta.glob('@/layouts/*.html', { eager: true })
const pages = import.meta.glob('@/pages/*.html', { eager: true })

tbd.registerPages(components)
tbd.registerPages(layouts)
tbd.registerPages(pages) // Pages win short-name collisions

notify()

if (import.meta.hot) {
	import.meta.hot.accept('~/data/site', newSite => {
		if (newSite) {
			tbd.global('site', newSite.site)
			notify()
		}
	})

	// Accept self to handle template registration changes without reload
	import.meta.hot.accept()
}
