import { describe, expect, it } from 'vitest'
import { normalizeMethod, buildRequest } from '../request'
import { parseSwapStyle } from '../swap'
import type { ActionOptions } from '../types'

describe('normalizeMethod', () => {
	it('normalizes lowercase method', () => {
		expect(normalizeMethod('get')).toBe('GET')
		expect(normalizeMethod('post')).toBe('POST')
	})

	it('passes through uppercase methods', () => {
		expect(normalizeMethod('GET')).toBe('GET')
		expect(normalizeMethod('POST')).toBe('POST')
		expect(normalizeMethod('PUT')).toBe('PUT')
		expect(normalizeMethod('PATCH')).toBe('PATCH')
		expect(normalizeMethod('DELETE')).toBe('DELETE')
	})

	it('defaults unknown methods to GET', () => {
		expect(normalizeMethod('OPTIONS')).toBe('GET')
		expect(normalizeMethod('')).toBe('GET')
	})
})

describe('buildRequest', () => {
	it('builds a basic GET request', () => {
		const opts: ActionOptions = { method: 'GET', url: '/api/data' }
		const req = buildRequest(opts)
		expect(req.method).toBe('GET')
		expect(req.url).toBe('/api/data')
		expect(req.body).toBeUndefined()
	})

	it('includes custom headers', () => {
		const opts: ActionOptions = {
			method: 'POST',
			url: '/api/data',
			headers: { 'X-Custom': 'value' },
		}
		const req = buildRequest(opts)
		expect(req.headers['X-Custom']).toBe('value')
	})

	it('passes target and swap options through', () => {
		const opts: ActionOptions = {
			method: 'GET',
			url: '/api/data',
			target: '#result',
			swap: 'outerHTML',
		}
		const req = buildRequest(opts)
		expect(req.target).toBe('#result')
		expect(req.swap).toBe('outerHTML')
	})

	it('extracts form data from trigger element when POST', () => {
		const form = document.createElement('form')
		const input = document.createElement('input')
		input.name = 'email'
		input.value = 'test@example.com'
		form.appendChild(input)

		const opts: ActionOptions = { method: 'POST', url: '/submit' }
		const req = buildRequest(opts, form)
		expect(req.url).toBe('/submit')
		expect(req.body).toBeInstanceOf(URLSearchParams)
	})

	it('does not extract form data for GET', () => {
		const form = document.createElement('form')
		const opts: ActionOptions = { method: 'GET', url: '/api' }
		const req = buildRequest(opts, form)
		expect(req.body).toBeUndefined()
	})
})

describe('parseSwapStyle', () => {
	it('parses valid swap styles', () => {
		expect(parseSwapStyle('innerHTML')).toBe('innerHTML')
		expect(parseSwapStyle('outerHTML')).toBe('outerHTML')
		expect(parseSwapStyle('beforebegin')).toBe('beforebegin')
		expect(parseSwapStyle('afterbegin')).toBe('afterbegin')
		expect(parseSwapStyle('beforeend')).toBe('beforeend')
		expect(parseSwapStyle('afterend')).toBe('afterend')
	})

	it('is case insensitive', () => {
		expect(parseSwapStyle('INNERHTML')).toBe('innerHTML')
		expect(parseSwapStyle('OuterHTML')).toBe('outerHTML')
	})

	it('returns null for invalid styles', () => {
		expect(parseSwapStyle('morph')).toBeNull()
		expect(parseSwapStyle('')).toBeNull()
	})
})
