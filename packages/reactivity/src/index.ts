import { Computed } from './computed'
import { Effect } from './effect'
import { readHydrationState, type HydrationRoot } from './hydration'
import { mountStateBindings, bindEvent, bindText } from './mount'
import { Signal } from './signal'
import { createStateScope, type StateBindingSpec } from './state-scope'
import { SignalStore } from './store'

export { Computed, Effect, Signal, SignalStore }
export { readHydrationState, mountStateBindings, bindEvent, bindText, createStateScope }
export type { HydrationRoot, StateBindingSpec }

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
