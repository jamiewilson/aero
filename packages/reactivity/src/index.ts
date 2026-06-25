import { Computed } from './computed'
import { Effect } from './effect'
import { readHydrationState, type HydrationRoot } from './hydration'
import { mountStateBindings, bindEvent, bindText } from './mount'
import { Signal } from './signal'
import { createStateScope, type StateBindingSpec } from './state-scope'
import { SignalStore } from './store'
import { AeroReactivity, adoptFragment, createDefaultHandlers } from './adopt'
import { bindShow } from './bindings/show'
import { bindHtml } from './bindings/html'
import { bindClassToggle } from './bindings/class'
import { bindProperty } from './bindings/property'
import { bindFormModel } from './bindings/model'
import { bindReactiveIf } from './structural/if'
import { bindKeyedFor } from './structural/for'

export { Computed, Effect, Signal, SignalStore }
export {
	readHydrationState,
	mountStateBindings,
	bindEvent,
	bindText,
	createStateScope,
	bindShow,
	bindHtml,
	bindClassToggle,
	bindProperty,
	bindFormModel,
	bindReactiveIf,
	bindKeyedFor,
	AeroReactivity,
	adoptFragment,
	createDefaultHandlers,
}
export type { HydrationRoot, StateBindingSpec }

export interface ReactivityRuntime {
	readonly kind: 'reactivity-runtime'
	readonly store: SignalStore
	readonly adopt: (container: ParentNode, store?: SignalStore) => () => void
}

export interface ReactivityRuntimeOptions {
	readonly debug?: boolean
	readonly initialState?: Record<string, unknown>
	readonly hydrationRoot?: HydrationRoot
}

/**
 * Phase 2+ reactivity entrypoint with optional adopt() for runtime fragments.
 */
export function createReactivityRuntime(options: ReactivityRuntimeOptions = {}): ReactivityRuntime {
	const initial = options.initialState ?? readHydrationState(options.hydrationRoot)
	const store = new SignalStore()
	store.merge(initial)
	const reactivity = new AeroReactivity(store)
	return {
		kind: 'reactivity-runtime',
		store,
		adopt: (container, sharedStore) => reactivity.adopt(container, sharedStore),
	}
}
