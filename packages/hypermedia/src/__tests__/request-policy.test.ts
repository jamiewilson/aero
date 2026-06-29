import { describe, expect, it } from 'vitest'
import {
	applySelectFilter,
	MAX_REQUEST_ATTEMPTS,
	shouldRetryError,
	shouldRetryStatus,
} from '../request-policy'

describe('shouldRetryStatus', () => {
	it('never retries 4xx responses', () => {
		expect(shouldRetryStatus(404, 'auto')).toBe(false)
		expect(shouldRetryStatus(422, 'error')).toBe(false)
	})

	it('retries 5xx only for error mode', () => {
		expect(shouldRetryStatus(500, 'auto')).toBe(false)
		expect(shouldRetryStatus(503, 'error')).toBe(true)
	})

	it('never retries for never mode', () => {
		expect(shouldRetryStatus(503, 'never')).toBe(false)
	})
})

describe('shouldRetryError', () => {
	it('retries network errors for auto and error', () => {
		const network = new TypeError('Failed to fetch')
		expect(shouldRetryError(network, 'auto')).toBe(true)
		expect(shouldRetryError(network, 'error')).toBe(true)
	})

	it('does not retry network errors for never', () => {
		expect(shouldRetryError(new TypeError('Failed to fetch'), 'never')).toBe(false)
	})

	it('does not retry abort errors', () => {
		const abort = new DOMException('Aborted', 'AbortError')
		expect(shouldRetryError(abort, 'auto')).toBe(false)
	})
})

describe('applySelectFilter', () => {
	it('returns full html when select is omitted', () => {
		expect(applySelectFilter('<div id="a">x</div>', undefined)).toBe('<div id="a">x</div>')
	})

	it('returns matched element outerHTML', () => {
		const html = '<div class="wrap"><section id="part">hello</section></div>'
		expect(applySelectFilter(html, '#part')).toBe('<section id="part">hello</section>')
	})

	it('returns null when selector does not match', () => {
		expect(applySelectFilter('<div>no match</div>', '#missing')).toBeNull()
	})
})

describe('MAX_REQUEST_ATTEMPTS', () => {
	it('caps retries at three attempts', () => {
		expect(MAX_REQUEST_ATTEMPTS).toBe(3)
	})
})
