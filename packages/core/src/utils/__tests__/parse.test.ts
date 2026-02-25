/**
 * Unit tests for utils/parse.ts: extractObjectKeys.
 */

import { describe, it, expect } from 'vitest'
import { extractObjectKeys } from '../parse'

/** extractObjectKeys: parses object literal/shorthand to keys; used for pass:data preamble in client scripts. */
describe('extractObjectKeys', () => {
	it('should extract simple keys', () => {
		expect(extractObjectKeys('{ a: 1, b: 2 }')).toEqual(['a', 'b'])
	})

	it('should extract shorthand keys', () => {
		expect(extractObjectKeys('{ config, theme }')).toEqual(['config', 'theme'])
	})

	it('should handle mixed shorthand and full properties', () => {
		expect(extractObjectKeys('{ debug, title: header.title }')).toEqual(['debug', 'title'])
	})

	it('should ignore spread syntax', () => {
		expect(extractObjectKeys('{ ...spread, a: 1 }')).toEqual(['a'])
	})

	it('should handle nested objects and arrays', () => {
		expect(extractObjectKeys('{ nested: { a: 1, b: 2 }, arr: [1, 2, 3] }')).toEqual([
			'nested',
			'arr',
		])
	})

	it('should handle expressions with parentheses', () => {
		expect(extractObjectKeys('{ computed: (1 + 2) }')).toEqual(['computed'])
	})

	it('should handle no outer braces', () => {
		expect(extractObjectKeys('a: 1, b: 2')).toEqual(['a', 'b'])
	})

	it('should handle empty input', () => {
		expect(extractObjectKeys('{}')).toEqual([])
		expect(extractObjectKeys('  ')).toEqual([])
	})
})
