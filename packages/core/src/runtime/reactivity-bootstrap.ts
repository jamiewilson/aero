import { createReactivityRuntime, type ReactivityRuntime } from '@aero-js/reactivity'

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

/** Drop the bootstrapped runtime so the next mount hydrates from the current document. */
export function resetBootstrappedReactivityRuntime(): void {
	const existing = readBootstrappedReactivityRuntime()
	if (!existing) return
	existing.store.destroy()
	delete runtimeGlobal()[REACTIVITY_RUNTIME_GLOBAL_KEY]
}

export function bootstrapReactivityRuntime(): ReactivityRuntime {
	const existing = readBootstrappedReactivityRuntime()
	if (existing) return existing
	const created = createReactivityRuntime()
	runtimeGlobal()[REACTIVITY_RUNTIME_GLOBAL_KEY] = created
	return created
}
