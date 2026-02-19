import type { MountOptions } from './types'
import { Aero } from './runtime'
import { aero, onUpdate } from './runtime/instance'
import { renderPage } from './runtime/client'

const coreRender = aero.render.bind(aero)

let lastEl: HTMLElement
let unsubscribe: () => void

function mount(options: MountOptions = {}): Promise<void> {
	const { target = '#app', onRender } = options

	const el =
		typeof target === 'string' ? (document.querySelector(target) as HTMLElement) : target

	if (!el) throw new Error('Target element not found: ' + target)

	lastEl = el

	// Skip initial render as we assume SSR provided the correct HTML.
	// We just need to initialize any client-side logic (listeners, hydration, etc.)
	if (onRender) onRender(el)
	const done = Promise.resolve()

	if (import.meta.hot && !unsubscribe) {
		unsubscribe = onUpdate(() => {
			if (lastEl) {
				void renderPage(lastEl, coreRender).then(() => {
					if (onRender) onRender(lastEl)
				})
			}
		})
	}

	return done
}

aero.mount = mount

export default aero as Aero & { mount: typeof mount }
