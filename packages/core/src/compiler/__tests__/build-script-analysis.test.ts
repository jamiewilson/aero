/**
 * Unit tests for build-script-analysis: AST-based import and getStaticPaths extraction.
 */

import { describe, it, expect } from 'vitest'
import { analyzeBuildScript } from '../build-script-analysis'

describe('analyzeBuildScript', () => {
	describe('imports', () => {
		it('should extract default import', () => {
			const script = `import logo from '@components/logo'
const x = logo`
			const result = analyzeBuildScript(script)
			expect(result.imports).toHaveLength(1)
			expect(result.imports[0].specifier).toBe('@components/logo')
			expect(result.imports[0].defaultBinding).toBe('logo')
			expect(result.imports[0].namedBindings).toEqual([])
			expect(result.imports[0].namespaceBinding).toBeNull()
			expect(result.scriptWithoutImportsAndGetStaticPaths).toContain('const x = logo')
			expect(result.scriptWithoutImportsAndGetStaticPaths).not.toContain('import')
		})

		it('should extract named imports', () => {
			const script = `import { foo, bar } from './mod'
const x = foo + bar`
			const result = analyzeBuildScript(script)
			expect(result.imports).toHaveLength(1)
			expect(result.imports[0].specifier).toBe('./mod')
			expect(result.imports[0].defaultBinding).toBeNull()
			expect(result.imports[0].namedBindings).toEqual([
				{ imported: 'foo', local: 'foo' },
				{ imported: 'bar', local: 'bar' },
			])
			expect(result.imports[0].namespaceBinding).toBeNull()
			expect(result.scriptWithoutImportsAndGetStaticPaths).toContain('const x = foo + bar')
		})

		it('should extract named import with alias', () => {
			const script = `import { foo as f } from './mod'`
			const result = analyzeBuildScript(script)
			expect(result.imports[0].namedBindings).toEqual([{ imported: 'foo', local: 'f' }])
		})

		it('should extract namespace import', () => {
			const script = `import * as ns from './mod'
const x = ns.default`
			const result = analyzeBuildScript(script)
			expect(result.imports[0].namespaceBinding).toBe('ns')
			expect(result.imports[0].defaultBinding).toBeNull()
			expect(result.imports[0].namedBindings).toEqual([])
			expect(result.scriptWithoutImportsAndGetStaticPaths).toContain('const x = ns.default')
		})

		it('should extract multiple imports', () => {
			const script = `import a from './a'
import { b } from './b'
import * as c from './c'
const x = a + b + c`
			const result = analyzeBuildScript(script)
			expect(result.imports).toHaveLength(3)
			expect(result.imports[0].specifier).toBe('./a')
			expect(result.imports[0].defaultBinding).toBe('a')
			expect(result.imports[1].specifier).toBe('./b')
			expect(result.imports[1].namedBindings).toEqual([{ imported: 'b', local: 'b' }])
			expect(result.imports[2].specifier).toBe('./c')
			expect(result.imports[2].namespaceBinding).toBe('c')
			expect(result.scriptWithoutImportsAndGetStaticPaths).toContain('const x = a + b + c')
		})

		it('should skip type-only imports for runtime bindings', () => {
			const script = `import type { T } from './types'
import { value } from './mod'
const x = value`
			const result = analyzeBuildScript(script)
			expect(result.imports).toHaveLength(2)
			expect(result.imports[0].namedBindings).toEqual([])
			expect(result.imports[0].specifier).toBe('./types')
			expect(result.imports[1].namedBindings).toEqual([{ imported: 'value', local: 'value' }])
		})
	})

	describe('getStaticPaths', () => {
		it('should extract sync getStaticPaths', () => {
			const script = `const x = 1;
export function getStaticPaths() {
	return [{ params: { id: 'a' } }]
}
const y = 2;`
			const result = analyzeBuildScript(script)
			expect(result.getStaticPathsFn).not.toBeNull()
			expect(result.getStaticPathsFn).toContain('export function getStaticPaths()')
			expect(result.getStaticPathsFn).toContain("return [{ params: { id: 'a' } }]")
			expect(result.scriptWithoutImportsAndGetStaticPaths).toContain('const x = 1;')
			expect(result.scriptWithoutImportsAndGetStaticPaths).toContain('const y = 2;')
			expect(result.scriptWithoutImportsAndGetStaticPaths).not.toContain('getStaticPaths')
		})

		it('should extract async getStaticPaths', () => {
			const script = `export async function getStaticPaths() {
	const data = await fetch('/api')
	return data
}`
			const result = analyzeBuildScript(script)
			expect(result.getStaticPathsFn).toContain('export async function getStaticPaths()')
			expect(result.getStaticPathsFn).toContain('await fetch')
			expect(result.scriptWithoutImportsAndGetStaticPaths).toBe('')
		})

		it('should handle nested braces in getStaticPaths', () => {
			const script = `export function getStaticPaths() {
	const items = [{ a: 1 }, { b: 2 }]
	if (items.length > 0) {
		return items.map(i => ({ params: i }))
	}
	return []
}`
			const result = analyzeBuildScript(script)
			expect(result.getStaticPathsFn).not.toBeNull()
			expect(result.getStaticPathsFn).toContain('return []')
			expect(result.scriptWithoutImportsAndGetStaticPaths).toBe('')
		})

		it('should return null when no getStaticPaths', () => {
			const script = `const x = 1;
const y = 2;`
			const result = analyzeBuildScript(script)
			expect(result.getStaticPathsFn).toBeNull()
			expect(result.scriptWithoutImportsAndGetStaticPaths).toBe(script.trim())
		})

		it('should extract getStaticPaths with braces in strings and comments', () => {
			const script = `export async function getStaticPaths() {
    // { brace in comment }
    const a = "{ brace in string }"
    const b = \`{ brace in template }\`
    return [{ params: { slug: 'complex' } }]
}`
			const result = analyzeBuildScript(script)
			expect(result.getStaticPathsFn).not.toBeNull()
			expect(result.getStaticPathsFn).toContain('// { brace in comment }')
			expect(result.getStaticPathsFn).toContain('const a = "{ brace in string }"')
			expect(result.getStaticPathsFn).toContain('const b = `{ brace in template }`')
			expect(result.getStaticPathsFn).toContain("params: { slug: 'complex' }")
		})
	})

	describe('combined', () => {
		it('should remove both imports and getStaticPaths', () => {
			const script = `import header from '@components/header'
export function getStaticPaths() { return [] }
const title = 'Page'`
			const result = analyzeBuildScript(script)
			expect(result.imports).toHaveLength(1)
			expect(result.getStaticPathsFn).not.toBeNull()
			expect(result.scriptWithoutImportsAndGetStaticPaths).toContain("const title = 'Page'")
			expect(result.scriptWithoutImportsAndGetStaticPaths).not.toContain('import')
			expect(result.scriptWithoutImportsAndGetStaticPaths).not.toContain('getStaticPaths')
		})
	})

	describe('edge cases', () => {
		it('should return script as-is for empty script', () => {
			const script = '   \n  '
			const result = analyzeBuildScript(script)
			expect(result.imports).toEqual([])
			expect(result.getStaticPathsFn).toBeNull()
			expect(result.scriptWithoutImportsAndGetStaticPaths).toBe(script)
		})

		it('should throw on parse error', () => {
			expect(() => analyzeBuildScript('import { from "./x"')).toThrow(/parse error/)
		})
	})
})
