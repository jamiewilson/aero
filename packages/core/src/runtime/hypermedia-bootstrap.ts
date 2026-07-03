import { createHypermediaRuntime, type HypermediaRuntime } from '@aero-js/hypermedia'
import { readBootstrappedReactivityRuntime } from './reactivity-bootstrap'

export const HYPERMEDIA_RUNTIME_GLOBAL_KEY = '__AERO_HYPERMEDIA_RUNTIME__'

type RuntimeGlobal = Record<string, unknown>

function runtimeGlobal(): RuntimeGlobal {
	return globalThis as unknown as RuntimeGlobal
}

export function readBootstrappedHypermediaRuntime(): HypermediaRuntime | null {
	const value = runtimeGlobal()[HYPERMEDIA_RUNTIME_GLOBAL_KEY]
	if (!value || typeof value !== 'object') return null
	return value as HypermediaRuntime
}

export function bootstrapHypermediaRuntime(): HypermediaRuntime {
	const existing = readBootstrappedHypermediaRuntime()
	if (existing) return existing
	const reactivity = import.meta.env.AERO_REACTIVITY === true
	const reactivityRuntime = reactivity ? readBootstrappedReactivityRuntime() : null
	const created = createHypermediaRuntime({
		reactivity,
		store: reactivityRuntime?.store,
	})
	runtimeGlobal()[HYPERMEDIA_RUNTIME_GLOBAL_KEY] = created
	return created
}
