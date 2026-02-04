import Alpine from 'alpinejs'
import persist from '@alpinejs/persist'
import type { ThemeStore } from '@data/theme'
import site from '@data/site'

Alpine.start()
Alpine.plugin(persist)

Alpine.store('theme', {
	current: Alpine.$persist(site.theme.default).as('theme'),
	set(this: ThemeStore) {
		const options = site.theme.options
		const index = options.indexOf(this.current)
		const next = options[(index + 1) % options.length]
		document.startViewTransition(() => {
			if (next) this.current = next
		})
	},
})

export default Alpine
