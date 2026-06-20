import { describe, expect, it } from 'vitest'
import { createHypermediaRuntime } from '../index'

describe('@aero-js/hypermedia scaffold', () => {
	it('exposes placeholder runtime factory', () => {
		expect(createHypermediaRuntime()).toEqual({ kind: 'hypermedia-runtime' })
	})
})
