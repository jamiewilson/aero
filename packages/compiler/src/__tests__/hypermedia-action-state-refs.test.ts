import { describe, expect, it } from 'vitest'
import {
	COMPILED_HYPERMEDIA_STATE_SIGNAL_CALLEE,
	rewriteHypermediaActionStateRefs,
} from '@aero-js/hypermedia'

describe('rewriteHypermediaActionStateRefs (compiler re-export)', () => {
	it('re-exports hypermedia rewrite with compiled callee constant', () => {
		const names = new Set(['isSaving'])
		expect(
			rewriteHypermediaActionStateRefs(
				"POST('/api/save', { state: isSaving })",
				names,
				{ signalCallee: COMPILED_HYPERMEDIA_STATE_SIGNAL_CALLEE }
			)
		).toBe("POST('/api/save', { state: actions.__aeroSignal(\"isSaving\") })")
	})
})
