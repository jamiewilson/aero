import { describe, expect, it } from 'vitest'
import { hypermediaErrorToViteOverlay } from '../hypermedia-dev-errors'

describe('hypermediaErrorToViteOverlay', () => {
	it('returns null without a response (transport errors)', () => {
		expect(hypermediaErrorToViteOverlay({ error: new Error('offline') })).toBeNull()
	})

	it('maps Nitro JSON envelopes', () => {
		expect(
			hypermediaErrorToViteOverlay({
				response: {
					status: 500,
					html: JSON.stringify({
						statusCode: 500,
						message: 'Cannot read properties of undefined',
						stack: ['at plugin', 'at nitro'],
					}),
					headers: { 'content-type': 'application/json' },
				},
				error: new Error('Cannot read properties of undefined'),
			})
		).toEqual({
			message: 'Cannot read properties of undefined',
			stack: 'at plugin\nat nitro',
			plugin: 'aero-hypermedia',
		})
	})

	it('maps non-JSON infrastructure HTML via the error message', () => {
		expect(
			hypermediaErrorToViteOverlay({
				response: {
					status: 500,
					html: '<!DOCTYPE html><html><body>boom</body></html>',
					headers: { 'content-type': 'text/html' },
				},
				error: new Error('[aero] Hypermedia infrastructure error (500)'),
			})
		).toEqual({
			message: '[aero] Hypermedia infrastructure error (500)',
			stack: '',
			plugin: 'aero-hypermedia',
		})
	})
})
