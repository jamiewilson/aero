import { describe, it, expect } from 'vitest'
import {
	collectBindingTypeStringsFromBuildScript,
	collectBindingTypeStringsFromBuildScripts,
	getBindingTypeStringFromBuildScript,
} from '../../build-script-type-inference'

describe('collectBindingTypeStringsFromBuildScript', () => {
	it('collects overlapping names from one script with first-win merge semantics across files', () => {
		const a = collectBindingTypeStringsFromBuildScripts([
			'const x: number = 1',
			'const x: string = "a"',
		])
		expect(a.get('x')).toBe('number')
	})
})

describe('getBindingTypeStringFromBuildScript', () => {
	it('returns explicit type for const', () => {
		expect(getBindingTypeStringFromBuildScript('const n: number = 1', 'n')).toBe('number')
	})

	it('returns inferred type for literal', () => {
		const t = getBindingTypeStringFromBuildScript('const n = 1', 'n')
		expect(t).toBeTruthy()
		expect(t === '1' || t === 'number').toBe(true)
	})

	it('collects destructure bindings', () => {
		const m = collectBindingTypeStringsFromBuildScript(`const { a, b } = { a: 1, b: 2 }`)
		expect(m.get('a')).toMatch(/number/)
		expect(m.get('b')).toMatch(/number/)
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
