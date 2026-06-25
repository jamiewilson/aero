import { describe, expect, it } from 'vitest'
import { createHypermediaRuntime } from '../index'

describe('@aero-js/hypermedia scaffold', () => {
	it('creates hypermedia runtime with correct kind', () => {
		expect(createHypermediaRuntime().kind).toBe('hypermedia-runtime')
	})
})
