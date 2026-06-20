import { Computed } from './computed'
import { Effect } from './effect'
import { Signal } from './signal'
import { SignalStore } from './store'

export { Computed, Effect, Signal, SignalStore }
export { readHydrationState } from './hydration'

export interface ReactivityRuntime {
	readonly kind: 'reactivity-runtime'
}

export interface ReactivityRuntimeOptions {
	readonly debug?: boolean
}

/**
 * Phase 2 kernel entrypoint scaffold.
 */
export function createReactivityRuntime(_options: ReactivityRuntimeOptions = {}): ReactivityRuntime {
	return { kind: 'reactivity-runtime' }
}
