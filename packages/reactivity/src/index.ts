import { Computed } from './computed'
import { Effect } from './effect'
import { readHydrationState, type HydrationRoot } from './hydration'
import { mountStateBindings, bindEvent, bindText } from './mount'
import { Signal } from './signal'
import { createStateScope, type StateBindingSpec } from './state-scope'
import { SignalStore } from './store'
import { AeroReactivity, processFragment, createDefaultHandlers } from './process'
import { bindShow } from './bindings/show'
import { bindHtml } from './bindings/html'
import { bindClassToggle } from './bindings/class'
import { bindProperty } from './bindings/property'
import { bindFormModel } from './bindings/model'
import { bindReactiveIf } from './structural/if'
import { bindKeyedFor } from './structural/for'
import { bindReactiveSwitch } from './structural/switch'

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
	bindReactiveSwitch,
	AeroReactivity,
	processFragment,
	createDefaultHandlers,
}
export type { HydrationRoot, StateBindingSpec }

export interface ReactivityRuntime {
	readonly kind: 'reactivity-runtime'
	readonly store: SignalStore
	readonly process: (element: ParentNode, store?: SignalStore) => () => void
}

export interface ReactivityRuntimeOptions {
	readonly debug?: boolean
	readonly initialState?: Record<string, unknown>
	readonly hydrationRoot?: HydrationRoot
}

/**
 * Phase 2+ reactivity entrypoint with optional process() for runtime fragments.
 */
export function createReactivityRuntime(options: ReactivityRuntimeOptions = {}): ReactivityRuntime {
	const initial = options.initialState ?? readHydrationState(options.hydrationRoot)
	const store = new SignalStore()
	store.merge(initial)
	const reactivity = new AeroReactivity(store)
	return {
		kind: 'reactivity-runtime',
		store,
		process: (element, sharedStore) => reactivity.process(element, sharedStore),
	}
}
