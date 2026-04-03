import { describe, it, expect } from 'vitest'
import {
	collectBuildScriptTypeDeclarationTexts,
	formatBuildScopeAmbientPrelude,
	iterateBuildScriptBindings,
} from '../build-scope-bindings'

describe('iterateBuildScriptBindings', () => {
	it('yields imports then declarations in script order', () => {
		const script = `import { foo } from 'm'
const x = 1
`
		const bindings = [...iterateBuildScriptBindings(script)]
		expect(bindings.map(b => [b.name, b.kind] as const)).toEqual([
			['foo', 'import'],
			['x', 'declaration'],
		])
	})

	it('skips imports when skipImports is true', () => {
		const script = `import { foo } from 'm'
const x = 1
`
		const bindings = [...iterateBuildScriptBindings(script, { skipImports: true })]
		expect(bindings.map(b => b.name)).toEqual(['x'])
	})

	it('collects destructured bindings and function names', () => {
		const script = `const { title: t } = Aero.props
function helper() {}
`
		const bindings = [...iterateBuildScriptBindings(script)]
		const names = bindings.map(b => [b.name, b.kind] as const)
		expect(names).toContainEqual(['t', 'declaration'])
		expect(names).toContainEqual(['helper', 'function'])
	})

	it('records object literal keys on simple declarations', () => {
		const script = `const o = { a: 1, b, c: 2 }`
		const bindings = [...iterateBuildScriptBindings(script)]
		const o = bindings.find(b => b.name === 'o')
		expect(o?.properties).toBeDefined()
		expect(o?.properties?.has('a')).toBe(true)
		expect(o?.properties?.has('b')).toBe(true)
		expect(o?.properties?.has('c')).toBe(true)
	})
})

describe('formatBuildScopeAmbientPrelude', () => {
	it('places type declarations before declare const lines', () => {
		const prelude = formatBuildScopeAmbientPrelude(new Set(['title']), [
			'interface PageProps { title: string }',
		])
		expect(prelude.indexOf('interface PageProps')).toBeLessThan(
			prelude.indexOf('declare const title')
		)
		expect(prelude).toContain('declare const title: any;')
	})

	it('uses checker types for bindings when build script bodies are provided', () => {
		const prelude = formatBuildScopeAmbientPrelude(
			new Set(['x', 'y']),
			[],
			['const x: number = 1', 'const y = "hi"']
		)
		expect(prelude).toContain('declare const x: number;')
		expect(prelude).toContain('declare const y:')
	})

	it('collectBuildScriptTypeDeclarationTexts flattens multiple scripts', () => {
		const texts = collectBuildScriptTypeDeclarationTexts([
			'type A = 1',
			`
interface B { x: number }
`,
		])
		expect(texts.some(t => t.includes('type A'))).toBe(true)
		expect(texts.some(t => t.includes('interface B'))).toBe(true)
	})
})
