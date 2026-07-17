import { describe, expect, it } from 'vitest'
import { HTTPError } from 'nitro/h3'
import { shouldLogIntentionalHttpError } from '../runtime-plugin'

describe('shouldLogIntentionalHttpError', () => {
	const event = { req: { method: 'GET' } } as never

	it('skips unhandled errors (Nitro already logs those)', () => {
		const error = Object.assign(new Error('boom'), { unhandled: true })
		expect(shouldLogIntentionalHttpError(error, event)).toBe(false)
	})

	it('skips when there is no request event', () => {
		expect(shouldLogIntentionalHttpError(HTTPError.status(500, 'fail'), undefined)).toBe(false)
	})

	it('skips non-HTTPError values', () => {
		expect(shouldLogIntentionalHttpError(new Error('plain'), event)).toBe(false)
	})

	it('skips 404 HTTPErrors', () => {
		expect(shouldLogIntentionalHttpError(HTTPError.status(404, 'missing'), event)).toBe(false)
	})

	it('logs intentional non-404 HTTPErrors', () => {
		expect(shouldLogIntentionalHttpError(HTTPError.status(500, 'fail'), event)).toBe(true)
		expect(shouldLogIntentionalHttpError(HTTPError.status(422, 'invalid'), event)).toBe(true)
	})
})
