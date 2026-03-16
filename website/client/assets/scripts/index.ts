import aero from '@aero-js/core'
import Alpine from '@scripts/alpine'

aero.mount({
	onRender(el: HTMLElement) {
		Alpine.initTree(el)
	},
})
