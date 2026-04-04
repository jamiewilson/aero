import { describe, expect, it } from 'vitest'
import { parseGraphFormat } from '../graph'

describe('parseGraphFormat', () => {
	it('defaults to lines', () => {
		expect(parseGraphFormat([])).toEqual({ format: 'lines', rest: [] })
	})

	it('parses --format json', () => {
		expect(parseGraphFormat(['--format', 'json'])).toEqual({ format: 'json', rest: [] })
	})

	it('parses -f fallow-entry', () => {
		expect(parseGraphFormat(['-f', 'fallow-entry'])).toEqual({ format: 'fallow-entry', rest: [] })
	})

	it('passes through unknown args', () => {
		expect(parseGraphFormat(['--format', 'json', 'extra'])).toEqual({
			format: 'json',
			rest: ['extra'],
		})
	})
})
