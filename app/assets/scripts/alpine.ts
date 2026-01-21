import Alpine from 'alpinejs'
import persist from '@alpinejs/persist'
import { Theme } from '~/data/theme'
import type { ThemeStore } from '~/data/theme-store'

Alpine.start()
Alpine.plugin(persist)

Alpine.store('theme', {
	modes: Object.values(Theme),
	current: Alpine.$persist(Theme.System).as('theme'),
	set(this: ThemeStore) {
		const idx = this.modes.indexOf(this.current)
		const next = this.modes[(idx + 1) % this.modes.length]
		document.startViewTransition(() => {
			if (next) this.current = next
		})
	},
})

export default Alpine
