import { describe, expect, it, vi } from 'vitest'
import { applySignalPatch, isJsonContentType, parseSignalPatch } from '../signal-patch'

describe('parseSignalPatch', () => {
	it('parses flat JSON objects', () => {
		expect(parseSignalPatch('{"count":2,"label":"ok"}')).toEqual({ count: 2, label: 'ok' })
	})

	it('rejects non-object payloads', () => {
		expect(parseSignalPatch('[]')).toBeNull()
		expect(parseSignalPatch('not-json')).toBeNull()
	})
})

describe('applySignalPatch', () => {
	it('shallow-merges via store.merge', () => {
		const merge = vi.fn()
		expect(applySignalPatch({ get: () => ({ value: 0 }), merge }, { count: 3 })).toBe(true)
		expect(merge).toHaveBeenCalledWith({ count: 3 })
	})

	it('returns false when merge is unavailable', () => {
		expect(applySignalPatch({ get: () => ({ value: 0 }) }, { count: 3 })).toBe(false)
	})
})

describe('isJsonContentType', () => {
	it('matches application/json', () => {
		expect(isJsonContentType('application/json')).toBe(true)
		expect(isJsonContentType('application/json; charset=utf-8')).toBe(true)
		expect(isJsonContentType('text/html')).toBe(false)
	})
})
