import { describe, expect, it } from 'vitest'
import { lineColumnAtOffset } from '../source-position'

describe('lineColumnAtOffset', () => {
	it('line 1 col 0 at start', () => {
		expect(lineColumnAtOffset('abc', 0)).toEqual({ line: 1, column: 0 })
	})

	it('counts newlines (1-based line, 0-based column)', () => {
		expect(lineColumnAtOffset('a\nb', 0)).toEqual({ line: 1, column: 0 })
		expect(lineColumnAtOffset('a\nb', 1)).toEqual({ line: 1, column: 1 })
		expect(lineColumnAtOffset('a\nb', 2)).toEqual({ line: 2, column: 0 })
		expect(lineColumnAtOffset('a\nbc', 3)).toEqual({ line: 2, column: 1 })
	})

	it('clamps offset to string bounds', () => {
		expect(lineColumnAtOffset('ab', -1)).toEqual({ line: 1, column: 0 })
		expect(lineColumnAtOffset('ab', 99)).toEqual({ line: 1, column: 2 })
	})
})
