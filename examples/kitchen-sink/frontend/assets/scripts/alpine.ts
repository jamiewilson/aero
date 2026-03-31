import type { ThemeStore } from '@content/theme'
import site from '@content/site'
import Alpine from 'alpinejs'
import persist from '@alpinejs/persist'

Alpine.start()
Alpine.plugin(persist)

const withViewTransition = (update: () => void) => {
	if (typeof document.startViewTransition === 'function') {
		document.startViewTransition(update)
		return
	}
	update()
}

Alpine.store(site.theme.storageKey, {
	current: Alpine.$persist(site.theme.default).as(site.theme.storageKey),

	init(this: ThemeStore) {
		Alpine.effect(() => {
			document.documentElement.setAttribute(site.theme.attribute, this.current)
		})
	},

	set(this: ThemeStore) {
		const options = site.theme.options
		const index = options.indexOf(this.current)
		const next = options[(index + 1) % options.length]
		withViewTransition(() => {
			if (next) this.current = next
		})
	},
})

export default Alpine
