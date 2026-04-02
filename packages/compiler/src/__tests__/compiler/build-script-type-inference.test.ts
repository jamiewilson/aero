import { describe, it, expect } from 'vitest'
import { getBindingTypeStringFromBuildScript } from '../../build-script-type-inference'

describe('getBindingTypeStringFromBuildScript', () => {
	it('returns explicit type for const', () => {
		expect(getBindingTypeStringFromBuildScript('const n: number = 1', 'n')).toBe('number')
	})

	it('returns inferred type for literal', () => {
		const t = getBindingTypeStringFromBuildScript('const n = 1', 'n')
		expect(t).toBeTruthy()
		expect(t === '1' || t === 'number').toBe(true)
	})

	it('returns null for missing binding', () => {
		expect(getBindingTypeStringFromBuildScript('const a = 1', 'missing')).toBeNull()
	})

	it('resolves function declaration name', () => {
		const t = getBindingTypeStringFromBuildScript('function f(): number { return 1 }', 'f')
		expect(t).toBeTruthy()
		expect(t).toMatch(/number/)
	})
})
