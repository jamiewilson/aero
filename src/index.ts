import { tbd, onUpdate } from '@src/runtime/instance'
import { TBD } from '@src/runtime'
import { renderPage } from '@src/runtime/client'


const coreRender = tbd.render.bind(tbd)

let lastEl: HTMLElement
let unsubscribe: () => void

interface MountOptions {
	target?: string | HTMLElement
	onRender?: (root: HTMLElement) => void
}

function mount(options: MountOptions = {}): Promise<void> {
	const { target = '#app', onRender } = options

	const el =
		typeof target === 'string' ? (document.querySelector(target) as HTMLElement) : target

	if (!el) throw new Error(`Target element not found: ${target}`)

	lastEl = el
	const done = renderPage(el, coreRender).then(() => {
		if (onRender) onRender(el)
	})

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

(tbd as any).mount = mount

export default tbd as TBD & { mount: typeof mount }
