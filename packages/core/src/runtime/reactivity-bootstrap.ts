import { createReactivityRuntime, type ReactivityRuntime } from '../reactivity'

export const REACTIVITY_RUNTIME_GLOBAL_KEY = '__AERO_REACTIVITY_RUNTIME__'

type RuntimeGlobal = Record<string, unknown>

function runtimeGlobal(): RuntimeGlobal {
	return globalThis as unknown as RuntimeGlobal
}

export function readBootstrappedReactivityRuntime(): ReactivityRuntime | null {
	const value = runtimeGlobal()[REACTIVITY_RUNTIME_GLOBAL_KEY]
	if (!value || typeof value !== 'object') return null
	return value as ReactivityRuntime
}

export function bootstrapReactivityRuntime(): ReactivityRuntime {
	const existing = readBootstrappedReactivityRuntime()
	if (existing) return existing
	const created = createReactivityRuntime()
	runtimeGlobal()[REACTIVITY_RUNTIME_GLOBAL_KEY] = created
	return created
}
