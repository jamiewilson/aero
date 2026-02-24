import aero from '@aero-ssg/core'

const htmx = (await import('htmx.org')).default
const Alpine = (await import('@scripts/alpine')).default

htmx.config.globalViewTransitions = true
htmx.onLoad(node => Alpine.initTree(node as HTMLElement))

aero.mount({
	target: '#custom-target',
	onRender(el: HTMLElement) {
		htmx.process(el)
		Alpine.initTree(el)
	},
})
