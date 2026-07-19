import { createHypermediaRuntime, type HypermediaRuntime } from '@aero-js/hypermedia'
import { showHypermediaInfrastructureErrorOverlay } from './hypermedia-dev-errors'
import { readBootstrappedReactivityRuntime } from './reactivity-bootstrap'
import { getOrCreateGlobal, readBootstrappedGlobal } from './bootstrap-global'

export const HYPERMEDIA_RUNTIME_GLOBAL_KEY = '__AERO_HYPERMEDIA_RUNTIME__'

export function readBootstrappedHypermediaRuntime(): HypermediaRuntime | null {
	return readBootstrappedGlobal<HypermediaRuntime>(HYPERMEDIA_RUNTIME_GLOBAL_KEY)
}

export function bootstrapHypermediaRuntime(): HypermediaRuntime {
	return getOrCreateGlobal(HYPERMEDIA_RUNTIME_GLOBAL_KEY, () => {
		const reactivity = import.meta.env.AERO_REACTIVITY === true
		const reactivityRuntime = reactivity ? readBootstrappedReactivityRuntime() : null
		return createHypermediaRuntime({
			reactivity,
			store: reactivityRuntime?.store,
			onInfrastructureError: showHypermediaInfrastructureErrorOverlay,
		})
	})
}
