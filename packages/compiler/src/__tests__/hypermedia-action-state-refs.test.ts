import { describe, expect, it } from 'vitest'
import { rewriteHypermediaActionStateRefs } from '../hypermedia-action-state-refs'

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

	it('leaves unknown identifiers unchanged', () => {
		const names = new Set(['isSaving'])
		expect(
			rewriteHypermediaActionStateRefs("POST('/api/save', { state: other })", names)
		).toBe("POST('/api/save', { state: other })")
	})
})
