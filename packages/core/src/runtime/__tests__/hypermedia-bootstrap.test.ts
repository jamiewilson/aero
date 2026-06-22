import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
	HYPERMEDIA_RUNTIME_GLOBAL_KEY,
	bootstrapHypermediaRuntime,
	readBootstrappedHypermediaRuntime,
} from '../hypermedia-bootstrap'

describe('bootstrapHypermediaRuntime', () => {
	beforeEach(() => {
		const globalObj = globalThis as unknown as Record<string, unknown>
		delete globalObj[HYPERMEDIA_RUNTIME_GLOBAL_KEY]
	})

	it('creates runtime once', () => {
		const first = bootstrapHypermediaRuntime()
		const second = bootstrapHypermediaRuntime()
		expect(first).toBe(second)
		expect(readBootstrappedHypermediaRuntime()).toBe(first)
		expect((first as { kind?: string }).kind).toBe('hypermedia-runtime')
	})
})
