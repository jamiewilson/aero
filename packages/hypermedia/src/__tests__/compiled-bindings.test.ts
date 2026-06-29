import { describe, expect, it } from 'vitest'
import { isCompiledBindMarker, hasCompiledBindSubtree } from '../compiled-bindings'

describe('isCompiledBindMarker', () => {
	it('matches numeric bind ids only', () => {
		expect(isCompiledBindMarker('0')).toBe(true)
		expect(isCompiledBindMarker('12')).toBe(true)
		expect(isCompiledBindMarker('{ GET("/x") }')).toBe(false)
		expect(isCompiledBindMarker('')).toBe(false)
	})
})

describe('hasCompiledBindSubtree', () => {
	it('detects compiler-emitted reactive markers', () => {
		const host = document.createElement('div')
		host.innerHTML = '<span data-aero-text="0">x</span>'
		expect(hasCompiledBindSubtree(host)).toBe(true)
	})

	it('ignores runtime hypermedia attributes', () => {
		const host = document.createElement('div')
		host.innerHTML = '<button data-aero-on-click="{ GET(\'/x\') }">go</button>'
		expect(hasCompiledBindSubtree(host)).toBe(false)
	})
})
