import aero from 'aerobuilt'

/** Minimal type for htmx loaded via script tag (CDN). */
interface HtmxGlobal {
	config: { globalViewTransitions: boolean }
	onLoad(fn: (node: Node) => void): void
	process(el: HTMLElement): void
}

declare global {
	var htmx: HtmxGlobal
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
