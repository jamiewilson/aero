import { describe, expect, it } from 'vitest'
import { HTTPError } from 'nitro/h3'
import handler from '../nitro-error-handler'

function createEvent(pathname: string, accept: string) {
	const req = new Request(`http://localhost${pathname}`, {
		headers: { Accept: accept },
	})
	return { req, context: {} } as Parameters<typeof handler>[1]
}

describe('nitro-error-handler', () => {
	it('returns JSON for /api routes even when Accept includes text/html', async () => {
		const error = HTTPError.status(404, 'Demo API route not found')
		const response = await handler(error, createEvent('/api/demos/error/not-found', 'application/json, text/html'))
		expect(response.headers.get('content-type')).toContain('application/json')
		const body = await response.json()
		expect(body).toEqual({ status: 404, message: 'Demo API route not found' })
	})

	it('returns JSON when Accept prefers JSON without text/html', async () => {
		const error = HTTPError.status(500, 'Boom')
		const response = await handler(error, createEvent('/about', 'application/json'))
		expect(response.headers.get('content-type')).toContain('application/json')
		const body = await response.json()
		expect(body.status).toBe(500)
	})
})
