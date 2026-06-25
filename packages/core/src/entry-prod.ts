/**
 * Minimal client entry for static production builds.
 *
 * @remarks
 * Does not import the runtime instance (no import.meta.glob of components/layouts/pages),
 * so the production client bundle stays small. Reactive pages load route-scoped binding modules
 * via the generated `virtual:aero/state-bindings-registry` map.
 * Use this when building for production; dev uses the full entry (entry-dev.ts) for HMR.
 */

import type { MountOptions } from './types'
import { Aero } from './runtime'
import { resolveMountTarget } from './runtime/mount-target'
import {
	bootstrapReactivityRuntime,
	readBootstrappedReactivityRuntime,
} from './runtime/reactivity-bootstrap'
import { mountStateBindingsForRoute } from './runtime/state-bindings-prod'
import { resolveStateBindingsModule } from 'virtual:aero/state-bindings-registry.ts'

let destroyStateBindings: (() => void) | null = null
let mountSeq = 0

function currentPathname(): string {
	return typeof window !== 'undefined' ? window.location.pathname : '/'
}

function mount(options: MountOptions = {}): Promise<void> {
	const { target = '#app', onRender } = options

	const el = resolveMountTarget(target)
	const seq = ++mountSeq
	if (destroyStateBindings) {
		destroyStateBindings()
		destroyStateBindings = null
	}
	bootstrapReactivityRuntime()
	return mountStateBindingsForRoute(
		aero,
		currentPathname(),
		el,
		resolveStateBindingsModule
	).then(cleanup => {
		if (seq !== mountSeq) {
			cleanup()
			return
		}
		destroyStateBindings = cleanup
		if (onRender) onRender(el)
	})
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
