import { createReactivityRuntime, type ReactivityRuntime } from '@aero-js/reactivity'
import {
	deleteBootstrappedGlobal,
	getOrCreateGlobal,
	readBootstrappedGlobal,
} from './bootstrap-global'

export const REACTIVITY_RUNTIME_GLOBAL_KEY = '__AERO_REACTIVITY_RUNTIME__'

export function readBootstrappedReactivityRuntime(): ReactivityRuntime | null {
	return readBootstrappedGlobal<ReactivityRuntime>(REACTIVITY_RUNTIME_GLOBAL_KEY)
}

/** Drop the bootstrapped runtime so the next mount hydrates from the current document. */
export function resetBootstrappedReactivityRuntime(): void {
	const existing = readBootstrappedReactivityRuntime()
	if (!existing) return
	existing.store.destroy()
	deleteBootstrappedGlobal(REACTIVITY_RUNTIME_GLOBAL_KEY)
}

export function bootstrapReactivityRuntime(): ReactivityRuntime {
	return getOrCreateGlobal(REACTIVITY_RUNTIME_GLOBAL_KEY, createReactivityRuntime)
}
