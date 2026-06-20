import { describe, expect, it } from 'vitest'
import { createReactivityRuntime } from '../index'

describe('@aero-js/reactivity scaffold', () => {
	it('exposes placeholder runtime factory', () => {
		expect(createReactivityRuntime()).toEqual({ kind: 'reactivity-runtime' })
	})
})
