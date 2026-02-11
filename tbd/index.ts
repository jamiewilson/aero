import { TBD } from '@tbd/runtime'
import { tbd, onUpdate } from '@tbd/runtime/instance'
import { renderPage } from '@tbd/runtime/client'
import type { MountOptions } from '@tbd/types'

const coreRender = tbd.render.bind(tbd)

let lastEl: HTMLElement
let unsubscribe: () => void

function mount(options: MountOptions = {}): Promise<void> {
	const { target = '#app', onRender } = options

	const el =
		typeof target === 'string' ? (document.querySelector(target) as HTMLElement) : target

	if (!el) throw new Error(`Target element not found: ${target}`)

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

tbd.mount = mount

export default tbd as TBD & { mount: typeof mount }
