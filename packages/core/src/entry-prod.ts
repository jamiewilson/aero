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
	attachRuntimeAccessors,
	bootstrapClientRuntimes,
	processStandaloneHypermediaDirectives,
	type HypermediaRuntimeWithSwapLifecycle,
	installHypermediaSwapLifecycle,
} from './runtime/client-mount'
import { shouldRemountCompiledSwap } from './runtime/swap-remount'
import { mountStateBindingsForRoute } from './runtime/state-bindings-prod'
import { resolveStateBindingsModule } from 'virtual:aero/state-bindings-registry.ts'

let destroyStateBindings: (() => void) | null = null
let cleanupSwapLifecycle: (() => void) | null = null
let hasActiveStateBindings = false
let mountSeq = 0

function currentPathname(): string {
	return typeof window !== 'undefined' ? window.location.pathname : '/'
}

function mountStateBindingsForCurrentRoute(el: HTMLElement) {
	return mountStateBindingsForRoute(aero, currentPathname(), el, resolveStateBindingsModule)
}

function mount(options: MountOptions = {}): Promise<void> {
	const { target = '#app', onRender } = options

	const el = resolveMountTarget(target)
	const seq = ++mountSeq
	if (cleanupSwapLifecycle) {
		cleanupSwapLifecycle()
		cleanupSwapLifecycle = null
	}
	if (destroyStateBindings) {
		destroyStateBindings()
		destroyStateBindings = null
	}
	hasActiveStateBindings = false
	bootstrapClientRuntimes()
	return mountStateBindingsForCurrentRoute(el).then(result => {
		if (seq !== mountSeq) {
			result.cleanup()
			return
		}
		destroyStateBindings = result.cleanup
		hasActiveStateBindings = result.hasStateBindings
		processStandaloneHypermediaDirectives(aero, currentPathname(), el)
		const runtime = getHypermediaRuntime()
		if (runtime) {
			cleanupSwapLifecycle = installHypermediaSwapLifecycle({
				root: el,
				runtime: runtime as unknown as HypermediaRuntimeWithSwapLifecycle,
				shouldRemountCompiled: operation =>
					shouldRemountCompiledSwap(el, operation, hasActiveStateBindings),
				destroyPrevious() {
					if (destroyStateBindings) {
						destroyStateBindings()
						destroyStateBindings = null
					}
					hasActiveStateBindings = false
				},
				async remountCompiled() {
					const next = await mountStateBindingsForCurrentRoute(el)
					destroyStateBindings = next.cleanup
					hasActiveStateBindings = next.hasStateBindings
					processStandaloneHypermediaDirectives(aero, currentPathname(), el)
				},
			})
		}
		if (onRender) onRender(el)
	})
}

const aero = new Aero()
aero.mount = mount
const { getReactivityRuntime, getHypermediaRuntime } = attachRuntimeAccessors(aero)

export default aero as Aero & {
	mount: typeof mount
	getReactivityRuntime: typeof getReactivityRuntime
	getHypermediaRuntime: typeof getHypermediaRuntime
}
