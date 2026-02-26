import aero from 'aerobuilt'
import htmx from 'htmx.org'
import Alpine from 'alpinejs'

Alpine.start()
htmx.config.globalViewTransitions = true
htmx.onLoad(node => Alpine.initTree(node as HTMLElement))

aero.mount({
	target: '#app',
	onRender(el) {
		htmx.process(el)
		Alpine.initTree(el)
	},
})
