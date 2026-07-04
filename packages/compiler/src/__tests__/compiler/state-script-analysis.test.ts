import { describe, expect, it } from 'vitest'
import { analyzeStateScript } from '../../state-script-analysis'
import { collectStateReferenceNames, lowerStateScript } from '../../lower-state-script'

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

	it('captures init expressions without collecting function declarations in analysis', () => {
		const script = `
			let count = 1
			let doubled = count * 2
			function inc() { count++ }
		`
		const result = analyzeStateScript(script)
		const byName = new Map(result.bindings.map(b => [b.name, b]))
		expect(byName.get('count')?.initExpr).toBe('1')
		expect(byName.get('doubled')?.initExpr).toBe('count * 2')

		const lowered = lowerStateScript(script, result)
		expect(lowered.scopeFunctions.map(fn => fn.name)).toEqual(['inc'])
	})

	it('captures reactive props from Aero.props destructures', () => {
		const result = analyzeStateScript(`
			const { count, label = 'Counter', title: heading, value = Aero.bindable(0), optional = Aero.bindable() } = Aero.props as Props
		`)
		const byName = new Map(result.bindings.map(b => [b.name, b]))

		expect(byName.get('count')).toMatchObject({
			reactiveProp: true,
			propName: 'count',
			required: true,
			initExpr: 'undefined',
		})
		expect(byName.get('label')).toMatchObject({
			reactiveProp: true,
			propName: 'label',
			required: false,
			initExpr: "'Counter'",
		})
		expect(byName.get('heading')).toMatchObject({
			reactiveProp: true,
			propName: 'title',
			required: true,
		})
		expect(byName.get('value')).toMatchObject({
			reactiveProp: true,
			propName: 'value',
			required: false,
			bindable: true,
			initExpr: '0',
		})
		expect(byName.get('optional')).toMatchObject({
			reactiveProp: true,
			propName: 'optional',
			required: false,
			bindable: true,
			initExpr: 'undefined',
		})
	})

	it('reports diagnostics when reactive props collide with owned state', () => {
		const result = analyzeStateScript(`
			const { count } = Aero.props
			let count = 0
		`)

		expect(result.diagnostics[0]?.message).toBe(
			'Reactive prop `count` conflicts with an owned state binding.'
		)
	})

	it('reports diagnostics when readonly reactive props are assigned in state script code', () => {
		const result = analyzeStateScript(`
			const { count, label, value = Aero.bindable(0) } = Aero.props
			function inc() { count++ }
			function rename() { label = 'Updated' }
			function update() { value++ }
		`)
		const byName = new Map(result.bindings.map(b => [b.name, b]))

		expect(byName.get('count')?.writes).toBe(true)
		expect(byName.get('label')?.writes).toBe(true)
		expect(byName.get('value')?.writes).toBe(true)
		expect(result.diagnostics.map(d => d.message)).toContain(
			'Reactive prop `count` is readonly; declare it with `Aero.bindable()` in the child and pass it with `bind:count="{ ... }"` from the parent to allow mutation.'
		)
		expect(result.diagnostics.map(d => d.message)).toContain(
			'Reactive prop `label` is readonly; declare it with `Aero.bindable()` in the child and pass it with `bind:label="{ ... }"` from the parent to allow mutation.'
		)
		expect(result.diagnostics.map(d => d.message)).not.toContain(
			'Reactive prop `value` is readonly; declare it with `Aero.bindable()` in the child and pass it with `bind:value="{ ... }"` from the parent to allow mutation.'
		)
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

	it('does not treat let state as derived when initializer only calls const helpers', () => {
		const result = analyzeStateScript(`
			const createID = () => crypto.randomUUID().split('-').pop()
			let items = [{ id: createID() }, { id: createID() }]
			function add() { items = [...items, { id: createID() }] }
		`)
		const byName = new Map(result.bindings.map(b => [b.name, b]))
		expect(byName.get('items')?.derived).toBe(false)
		expect(result.diagnostics).toEqual([])
	})

	it('still derives let state from other let bindings when const values participate', () => {
		const result = analyzeStateScript(`
			const offset = 5
			let count = 1
			let adjusted = count + offset
		`)
		const byName = new Map(result.bindings.map(b => [b.name, b]))
		expect(byName.get('adjusted')?.derived).toBe(true)
		expect(byName.get('adjusted')?.dependencies).toEqual(['count'])
	})

	it('excludes const arrow helpers from reactive bindings', () => {
		const script = `
			const createID = () => crypto.randomUUID().split('-').pop()
			let items = [{ id: createID() }]
		`
		const result = analyzeStateScript(script)
		const byName = new Map(result.bindings.map(b => [b.name, b]))
		expect(byName.has('createID')).toBe(false)
		expect(byName.get('items')?.derived).toBe(false)

		const lowered = lowerStateScript(script, result)
		expect(lowered.moduleConstants).toEqual([
			'const createID = () => crypto.randomUUID().split("-").pop()',
		])
	})

	it('collects state reference names from bindings, module helpers, and functions', () => {
		const script = `
			const createID = () => crypto.randomUUID()
			let items = [{ id: createID() }]
			function add() { items = [...items, { id: createID() }] }
		`
		const result = analyzeStateScript(script)
		expect([...collectStateReferenceNames(script, result)].sort()).toEqual(['add', 'createID', 'items'])
	})
})
