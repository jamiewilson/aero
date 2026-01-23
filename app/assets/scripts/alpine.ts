import Alpine from 'alpinejs'
import persist from '@alpinejs/persist'
import { site, type ThemeStore } from '~/data'

const modes = site.theme.modes

Alpine.start()
Alpine.plugin(persist)

Alpine.store('theme', {
	current: Alpine.$persist(site.theme.default).as('theme'),
	set(this: ThemeStore) {
		const idx = modes.indexOf(this.current)
		const next = modes[(idx + 1) % modes.length]
		document.startViewTransition(() => {
			if (next) this.current = next
		})
	},
})

export default Alpine
