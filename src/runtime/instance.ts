import { TBD } from '@src/runtime'
import site from '~/data/site'

const instance = (globalThis as any).__TBD_INSTANCE__ || new TBD()
const listeners = (globalThis as any).__TBD_LISTENERS__ || new Set<() => void>()
const tbd = instance

const onUpdate = (cb: () => void) => {
	listeners.add(cb)
	return () => listeners.delete(cb)
}

const notify = () => {
	listeners.forEach((cb: () => void) => cb())
}

if (!(globalThis as any).__TBD_INSTANCE__) {
	;(globalThis as any).__TBD_INSTANCE__ = instance
}

if (!(globalThis as any).__TBD_LISTENERS__) {
	;(globalThis as any).__TBD_LISTENERS__ = listeners
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
	import.meta.hot.accept('~/data/site', updated => {
		if (updated) {
			tbd.global('site', updated.site)
			notify()
		}
	})

	import.meta.hot.accept()
}

export { tbd, onUpdate }
