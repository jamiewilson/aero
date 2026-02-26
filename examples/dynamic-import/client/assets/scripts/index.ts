import aero from 'aerobuilt'

const htmx = (await import('htmx.org')).default
const Alpine = (await import('@scripts/alpine')).default

htmx.config.globalViewTransitions = true
htmx.onLoad(node => Alpine.initTree(node as HTMLElement))

aero.mount({
	target: '#app',
	onRender(el) {
		htmx.process(el)
		Alpine.initTree(el)
	},
})
