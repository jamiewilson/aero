import { describe, expect, it } from 'vitest'
import { firstStackSpan } from '../stack-frame'

describe('firstStackSpan', () => {
	it('parses unix path in parentheses', () => {
		const stack = `ReferenceError: toggle is not defined
    at render (/app/frontend/components/nav.html.js:42:10)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
		expect(firstStackSpan(stack)).toEqual({
			file: '/app/frontend/components/nav.html.js',
			line: 42,
			column: 10,
		})
	})

	it('parses at path without parentheses', () => {
		const stack = `Error: x
    at /tmp/foo.mjs:3:0`
		expect(firstStackSpan(stack)).toEqual({
			file: '/tmp/foo.mjs',
			line: 3,
			column: 0,
		})
	})

	it('parses Windows drive path', () => {
		const stack = `Error: x
    at fn (C:\\proj\\a.js:9:1)`
		expect(firstStackSpan(stack)).toEqual({
			file: 'C:\\proj\\a.js',
			line: 9,
			column: 1,
		})
	})

	it('skips anonymous frames', () => {
		const stack = `Error: x
    at <anonymous>:1:2`
		expect(firstStackSpan(stack)).toBeUndefined()
	})
})
