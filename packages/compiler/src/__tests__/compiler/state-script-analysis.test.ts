import { describe, expect, it } from 'vitest'
import { analyzeStateScript } from '../../state-script-analysis'

describe('analyzeStateScript', () => {
	it('marks bindings as derived when initializer references another binding', () => {
		const result = analyzeStateScript(`
			let a = 1
			let b = a + 2
			let c = b * 3
		`)

		const byName = new Map(result.bindings.map(b => [b.name, b]))
		expect(byName.get('a')?.derived).toBe(false)
		expect(byName.get('b')?.derived).toBe(true)
		expect(byName.get('b')?.dependencies).toEqual(['a'])
		expect(byName.get('c')?.derived).toBe(true)
		expect(byName.get('c')?.dependencies).toEqual(['b'])
	})

	it('captures init expressions and function declarations', () => {
		const result = analyzeStateScript(`
			let count = 1
			let doubled = count * 2
			function inc() { count++ }
		`)
		const byName = new Map(result.bindings.map(b => [b.name, b]))
		expect(byName.get('count')?.initExpr).toBe('1')
		expect(byName.get('doubled')?.initExpr).toBe('count * 2')
		expect(result.functionSources).toEqual(['function inc() { count++ }'])
	})

	it('reports diagnostics when derived bindings are assigned', () => {
		const result = analyzeStateScript(`
			let a = 1
			let b = a + 2
			b = 10
			b++
		`)
		expect(result.diagnostics.length).toBeGreaterThanOrEqual(2)
		expect(result.diagnostics[0]?.message).toMatch(/Derived state `b` is read-only/)
	})
})
