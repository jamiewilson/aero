import { Computed } from './computed'
import { Effect } from './effect'
import { readAeroJsonPayload, readHydrationState, reviveStateValue, type HydrationRoot } from './hydration'
import { mountStateBindings, bindEvent, bindText } from './mount'
import { Signal } from './signal'
import { createStateScope, type StateBindingSpec } from './state-scope'
import { SignalStore } from './store'
import { AeroReactivity, processFragment, unsafeProcessFragment, createDefaultHandlers } from './process'
import { bindShow } from './bindings/show'
import { bindHtml } from './bindings/html'
import { bindClassToggle } from './bindings/class'
import { bindAttribute } from './bindings/attribute'
import { bindProperty } from './bindings/property'
import { coerceAttributeValue, applyAttributeCoercion, formatAttributeBind } from './bindings/coerce-attribute-value'
import { bindFormModel } from './bindings/model'
import {
	isBooleanIdlPropertyForMirror,
	mirrorBooleanPresenceAttr,
	mirrorStringAttr,
	shouldMirrorContentAttribute,
} from './bindings/mirror-content-attribute'
import { bindReactiveIf } from './structural/if'
import { bindKeyedFor } from './structural/for'
import { bindReactiveSwitch } from './structural/switch'

export { Computed, Effect, Signal, SignalStore }
export {
	readAeroJsonPayload,
	readHydrationState,
	reviveStateValue,
	mountStateBindings,
	bindEvent,
	bindText,
	createStateScope,
	bindShow,
	bindHtml,
	bindClassToggle,
	bindAttribute,
	coerceAttributeValue,
	applyAttributeCoercion,
	formatAttributeBind,
	bindProperty,
	bindFormModel,
	isBooleanIdlPropertyForMirror,
	mirrorBooleanPresenceAttr,
	mirrorStringAttr,
	shouldMirrorContentAttribute,
	bindReactiveIf,
	bindKeyedFor,
	bindReactiveSwitch,
	AeroReactivity,
	processFragment,
	unsafeProcessFragment,
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
	store.mergeBindings(initial)
	const reactivity = new AeroReactivity(store)
	return {
		kind: 'reactivity-runtime',
		store,
		process: (element, sharedStore) => reactivity.process(element, sharedStore),
	}
}
