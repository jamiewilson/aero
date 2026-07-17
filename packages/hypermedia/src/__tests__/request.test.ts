import { describe, expect, it } from 'vitest'
import { buildRequest } from '../request'

describe('buildRequest', () => {
	it('defaults Accept to application/json, text/html', () => {
		const request = buildRequest({ method: 'GET', url: '/api/x' })
		expect(request.headers.Accept).toBe('application/json, text/html')
	})

	it('does not override an explicit Accept header', () => {
		const request = buildRequest({
			method: 'GET',
			url: '/api/x',
			headers: { Accept: 'text/html' },
		})
		expect(request.headers.Accept).toBe('text/html')
	})

	it('respects lowercase accept from the author', () => {
		const request = buildRequest({
			method: 'GET',
			url: '/api/x',
			headers: { accept: 'application/json' },
		})
		expect(request.headers.accept).toBe('application/json')
		expect(request.headers.Accept).toBeUndefined()
	})
})
