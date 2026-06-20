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
import { resolveMountTarget } from './runtime/mount-target'
import {
	bootstrapReactivityRuntime,
	readBootstrappedReactivityRuntime,
} from './runtime/reactivity-bootstrap'

let destroyStateBindings: (() => void) | null = null

function currentPathname(): string {
	return typeof window !== 'undefined' ? window.location.pathname : '/'
}

function mount(options: MountOptions = {}): Promise<void> {
	const { target = '#app', onRender } = options

	const el = resolveMountTarget(target)
	if (destroyStateBindings) {
		destroyStateBindings()
		destroyStateBindings = null
	}
	bootstrapReactivityRuntime()
	destroyStateBindings = aero.mountStateBindingsForPath(currentPathname(), el)

	if (onRender) onRender(el)

	return Promise.resolve()
}

const getReactivityRuntime = () => readBootstrappedReactivityRuntime()

const aero = new Aero()
aero.mount = mount
;(aero as Aero & { getReactivityRuntime: typeof getReactivityRuntime }).getReactivityRuntime =
	getReactivityRuntime

export default aero as Aero & {
	mount: typeof mount
	getReactivityRuntime: typeof getReactivityRuntime
}
