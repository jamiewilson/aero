import { describe, expect, it } from 'vitest'
import {
	COMPILED_HYPERMEDIA_STATE_SIGNAL_CALLEE,
	rewriteHypermediaActionStateRefs,
} from '../action-state-refs'

describe('rewriteHypermediaActionStateRefs', () => {
	it('rewrites owned binding names in state option', () => {
		const names = new Set(['isSaving'])
		expect(
			rewriteHypermediaActionStateRefs(
				"POST('/api/save', { target: '#x', state: isSaving })",
				names
			)
		).toBe("POST('/api/save', { target: '#x', state: __aeroSignal(\"isSaving\") })")
	})

	it('supports qualified callee for compiled mount handlers', () => {
		const names = new Set(['isSaving'])
		expect(
			rewriteHypermediaActionStateRefs(
				"GET('/api/demo', { target: '#x', state: isSaving })",
				names,
				{ signalCallee: COMPILED_HYPERMEDIA_STATE_SIGNAL_CALLEE }
			)
		).toBe("GET('/api/demo', { target: '#x', state: actions.__aeroSignal(\"isSaving\") })")
	})

	it('leaves unknown identifiers unchanged', () => {
		const names = new Set(['isSaving'])
		expect(
			rewriteHypermediaActionStateRefs("POST('/api/save', { state: other })", names)
		).toBe("POST('/api/save', { state: other })")
	})
})
