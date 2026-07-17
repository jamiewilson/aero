import { describe, it, expect } from 'vitest'
import {
	collectBuildScriptTypeDeclarationTexts,
	formatBuildScopeAmbientPrelude,
	iterateBuildScriptBindings,
} from '../build-scope-bindings'
import { collectBindingTypeStringsFromBuildScripts } from '../build-script-type-inference'

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

	it('collects destructured bindings with default values', () => {
		const script = `const { meta } = site
const {
	title = meta.title,
	description = meta.description,
	image = Aero.site.url + meta.ogImage,
} = Aero.props
const { svg: favicon } = meta.icon
`
		const bindings = [...iterateBuildScriptBindings(script)]
		expect(bindings.map(b => b.name)).toEqual([
			'meta',
			'title',
			'description',
			'image',
			'favicon',
		])
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

	it('collects arrow params, destructuring params, and for-of loop bindings', () => {
		const script = `
const linksById = new Map(
	[...document.querySelectorAll('[data-toc-link]')]
		.map(link => [link.hash.slice(1), link])
		.filter(([id]) => id)
)
for (const heading of [...linksById.keys()]) {
	document.getElementById(heading)
}
`
		const names = [...iterateBuildScriptBindings(script, { includeNestedBindings: true })].map(
			b => b.name
		)
		expect(names).toContain('linksById')
		expect(names).toContain('link')
		expect(names).toContain('id')
		expect(names).toContain('heading')
	})

	it('does not treat nested callback params as module-level bindings by default', () => {
		const script = `
export async function getStaticPaths() {
	const docs = await getCollection('docs')
	return docs.map(doc => ({ params: { slug: doc.id }, props: doc }))
}
const doc = Aero.props
`
		const defaultNames = [...iterateBuildScriptBindings(script)].map(b => b.name)
		expect(defaultNames.filter(n => n === 'doc')).toEqual(['doc'])

		const nestedNames = [...iterateBuildScriptBindings(script, { includeNestedBindings: true })].map(
			b => b.name
		)
		expect(nestedNames.filter(n => n === 'doc').length).toBeGreaterThan(1)
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

	it('uses checker types for bindings when precomputed types are provided', () => {
		const bodies = ['const x: number = 1', 'const y = "hi"']
		const prelude = formatBuildScopeAmbientPrelude(
			new Set(['x', 'y']),
			[],
			undefined,
			undefined,
			collectBindingTypeStringsFromBuildScripts(bodies)
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
