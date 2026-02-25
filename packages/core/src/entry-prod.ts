/**
 * Minimal client entry for static production builds.
 *
 * @remarks
 * Does not import the runtime instance (no import.meta.glob of components/layouts/pages),
 * so the production client bundle stays small: no template chunks, only mount + onRender.
 * Use this when building for production; dev uses the full entry (entry-dev.ts) for HMR.
 */

import type { MountOptions } from './types'
import { Aero } from './runtime'

function mount(options: MountOptions = {}): Promise<void> {
	const { target = '#app', onRender } = options

	const el =
		typeof target === 'string' ? (document.querySelector(target) as HTMLElement) : target

	if (!el) throw new Error('Target element not found: ' + target)

	if (onRender) onRender(el)

	return Promise.resolve()
}

const aero = new Aero()
aero.mount = mount

export default aero as Aero & { mount: typeof mount }
