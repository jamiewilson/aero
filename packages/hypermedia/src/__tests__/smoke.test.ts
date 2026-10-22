import { describe, expect, it } from 'vite-plus/test'
import { createHypermediaRuntime } from '../index'

describe('@aero-js/hypermedia scaffold', () => {
	it('creates hypermedia runtime with correct kind', () => {
		expect(createHypermediaRuntime().kind).toBe('hypermedia-runtime')
	})
})
