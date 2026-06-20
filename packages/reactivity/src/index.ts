import { Computed } from './computed'
import { Effect } from './effect'
import { Signal } from './signal'
import { readHydrationState, type HydrationRoot } from './hydration'
import { SignalStore } from './store'

export { Computed, Effect, Signal, SignalStore }
export { readHydrationState }
export type { HydrationRoot } from './hydration'

export interface ReactivityRuntime {
	readonly kind: 'reactivity-runtime'
	readonly store: SignalStore
}

export interface ReactivityRuntimeOptions {
	readonly debug?: boolean
	readonly initialState?: Record<string, unknown>
	readonly hydrationRoot?: HydrationRoot
}

/**
 * Phase 2 kernel entrypoint scaffold.
 */
export function createReactivityRuntime(options: ReactivityRuntimeOptions = {}): ReactivityRuntime {
	const initial = options.initialState ?? readHydrationState(options.hydrationRoot)
	const store = new SignalStore()
	store.merge(initial)
	return { kind: 'reactivity-runtime', store }
}
