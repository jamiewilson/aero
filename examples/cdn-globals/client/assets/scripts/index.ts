import aero from 'aerobuilt'

declare global {
	var htmx: typeof import('htmx.org').default
	var Alpine: import('alpinejs').Alpine
}

htmx.config.globalViewTransitions = true
htmx.onLoad(node => Alpine.initTree(node as HTMLElement))

aero.mount({
	target: '#app',
	onRender(el: HTMLElement) {
		htmx.process(el)
		Alpine.initTree(el)
	},
})
