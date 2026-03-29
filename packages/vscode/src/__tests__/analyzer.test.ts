/**
 * Unit tests for the Aero VS Code analyzer (analyzer.ts): template references (components,
 * attributes), defined variables (imports), template scopes (data-for), and variables by scope
 * (e.g. props/data-props in client/bundled scope). Mocks vscode Range/Position for offset→position conversion.
 */

import { describe, it, expect, vi } from 'vitest'
import {
	collectTemplateReferences,
	collectDefinedVariables,
	collectTemplateScopes,
	collectVariablesByScope,
} from '../analyzer'

vi.mock('vscode', () => {
	return {
		Range: class {
			start: any
			end: any
			constructor(start: any, end: any) {
				this.start = start
				this.end = end
			}
		},
		Position: class {
			line: any
			character: any
			constructor(line: any, character: any) {
				this.line = line
				this.character = character
			}
		},
	}
})

/** Component/attribute references in template; must skip HTML comments and structural directives (data-if, data-else, etc.) when not on elements. */
describe('collectTemplateReferences', () => {
	const mockDoc = {
		positionAt: (offset: number) => ({ line: 0, character: offset }),
	} as any

	it('should ignore components inside HTML comments', () => {
		const text = `
    <!-- <form-component /> -->
    <!--<header-component></header-component>-->
    <div></div>
    `
		const refs = collectTemplateReferences(mockDoc, text)

		// Should find NO components because they are all commented out
		const components = refs.filter(r => r.isComponent)
		expect(components).toHaveLength(0)
	})

	it('should still find components outside comments', () => {
		const text = `
    <!-- <form-component /> -->
    <header-component />
    `
		const refs = collectTemplateReferences(mockDoc, text)

		const components = refs.filter(r => r.isComponent)
		expect(components).toHaveLength(1)
		expect(components[0].content).toBe('header')
	})

	it('should ignore structural directives as standalone attributes', () => {
		const text = `
    <div data-if="true"></div>
    <div data-else></div>
    <div else></div>
    <div if="false"></div>
    `
		const refs = collectTemplateReferences(mockDoc, text)

		const attrs = refs.filter(r => r.isAttribute)
		expect(attrs).toHaveLength(0)
	})

	it('should not treat HTML boolean attributes (disabled, hidden, etc.) as variable refs', () => {
		const text = `
    <input disabled />
    <div hidden></div>
    <input readonly required />
    <button type="button" disabled>Submit</button>
    `
		const refs = collectTemplateReferences(mockDoc, text)

		const variableRefs = refs.filter(r => !r.isComponent && r.content !== 'props')
		expect(variableRefs.map(r => r.content)).not.toContain('disabled')
		expect(variableRefs.map(r => r.content)).not.toContain('hidden')
		expect(variableRefs.map(r => r.content)).not.toContain('readonly')
		expect(variableRefs.map(r => r.content)).not.toContain('required')
	})

	it('should treat standalone props / data-props as variable ref', () => {
		const text = `<my-component props />`
		const refs = collectTemplateReferences(mockDoc, text)

		const propsRefs = refs.filter(r => r.content === 'props' && r.isAttribute)
		expect(propsRefs).toHaveLength(1)
	})

	it('should not treat Aero standalone directives (else, data-else) as variable refs', () => {
		const text = `
    <div data-if="{ show }">yes</div>
    <div data-else>no</div>
    <div else>fallback</div>
    `
		const refs = collectTemplateReferences(mockDoc, text)

		const variableRefs = refs.filter(
			r => !r.isComponent && (r.content !== 'props' || !r.isAttribute)
		)
		expect(variableRefs.map(r => r.content)).not.toContain('else')
		// data-else is the attribute name; we don't add a ref for "else" or "data-else" as variable
		expect(variableRefs.filter(r => r.content === 'data-else')).toHaveLength(0)
	})
})

/** Build-scope defined variables (imports, etc.) and props variable positions in client (bundled) scope. */
describe('collectDefinedVariables', () => {
	const mockDoc = {
		positionAt: (offset: number) => ({ line: 0, character: offset }),
	} as any

	it('should correctly parse named imports in build scope', () => {
		const text = `<script is:build>
import { foo, bar } from 'pkg'
</script>`
		const [buildScopeVars] = collectDefinedVariables(mockDoc, text)

		expect(buildScopeVars.has('foo')).toBe(true)
		expect(buildScopeVars.get('foo')?.kind).toBe('import')
		expect(buildScopeVars.has('bar')).toBe(true)
		expect(buildScopeVars.get('bar')?.kind).toBe('import')

		expect(buildScopeVars.has('foo, bar')).toBe(false)
	})

	it('returns only build-scope variables (is:build), not client/bundled script vars', () => {
		const text = `<script is:build>
import { buildOnly } from 'pkg'
const buildVar = 1
</script>
<script>
const clientVar = 2
</script>`
		const [buildScopeVars] = collectDefinedVariables(mockDoc, text)

		expect(buildScopeVars.has('buildOnly')).toBe(true)
		expect(buildScopeVars.has('buildVar')).toBe(true)
		expect(buildScopeVars.has('clientVar')).toBe(false)
	})

	it('should calculate correct position for props variables', () => {
		const text = `<script props="{ isHomepage }">
	import { debug } from '@scripts/utils/debug'
</script>`
		const vars = collectVariablesByScope(mockDoc, text, 'bundled')

		expect(vars.has('isHomepage')).toBe(true)
		const varInfo = vars.get('isHomepage')
		expect(varInfo?.kind).toBe('reference')
		expect(varInfo?.range.start.character).toBe(17) // position of 'i' in "isHomepage" (props="{ isHomepage }")
		expect(varInfo?.range.end.character).toBe(27) // end of "isHomepage" (17 + 10)
	})

	it('should calculate correct position for props with no spaces', () => {
		const text = `<script props="{isHomepage}"></script>`
		const vars = collectVariablesByScope(mockDoc, text, 'bundled')

		expect(vars.has('isHomepage')).toBe(true)
		const varInfo = vars.get('isHomepage')
		expect(varInfo?.range.start.character).toBe(16) // position of 'i' in "isHomepage" (props="{isHomepage}")
		expect(varInfo?.range.end.character).toBe(26)
	})

	it('should calculate correct position for multiple props variables', () => {
		const text = `<script props="{ foo, bar }"></script>`
		const vars = collectVariablesByScope(mockDoc, text, 'bundled')

		expect(vars.has('foo')).toBe(true)
		expect(vars.has('bar')).toBe(true)
		expect(vars.get('foo')?.range.start.character).toBe(17) // position of 'f' in "foo" (props="{ foo, bar }")
		expect(vars.get('bar')?.range.start.character).toBe(22) // position of 'b' in "bar"
	})

	it('collects variables with type annotations (const x: Type = ...)', () => {
		const text = `<script is:build>
const meta: MetaProps = { title: 'x' }
</script>
<div>{ meta.title }</div>`
		const [buildScopeVars] = collectDefinedVariables(mockDoc, text)

		expect(buildScopeVars.has('meta')).toBe(true)
		expect(buildScopeVars.get('meta')?.kind).toBe('declaration')
	})
})

/** for / data-for scopes: binding names and iterable expression; nested loops return inner-first. */
describe('collectTemplateScopes', () => {
	const mockDoc = {
		positionAt: (offset: number) => ({ line: 0, character: offset }),
	} as any

	it('should parse data-for attribute', () => {
		const text = `
<ul>
	<li data-for="{ const item of items }">{item.name}</li>
</ul>
`
		const scopes = collectTemplateScopes(mockDoc, text)

		expect(scopes).toHaveLength(1)
		expect(scopes[0].bindingNames).toContain('item')
		expect(scopes[0].sourceExpr).toBe('items')
	})

	it('should parse shorthand for attribute', () => {
		const text = `
<ul>
	<li for="{ const user of users }">{user.name}</li>
</ul>
`
		const scopes = collectTemplateScopes(mockDoc, text)

		expect(scopes).toHaveLength(1)
		expect(scopes[0].bindingNames).toContain('user')
		expect(scopes[0].sourceExpr).toBe('users')
	})

	it('should handle nested data-for scopes', () => {
		const text = `
<div data-for="{ const category of categories }">
	<span data-for="{ const item of category.items }">{item.name}</span>
</div>
`
		const scopes = collectTemplateScopes(mockDoc, text)

		expect(scopes).toHaveLength(2)
		// Scopes are returned in closing order (inner first, then outer)
		expect(scopes[0].bindingNames).toContain('item')
		expect(scopes[1].bindingNames).toContain('category')
	})

	it('should parse destructuring binding names', () => {
		const text = `
<ul>
	<li for="{ const { name, id } of users }">{name}</li>
</ul>
`
		const scopes = collectTemplateScopes(mockDoc, text)

		expect(scopes).toHaveLength(1)
		expect(scopes[0].bindingNames.sort()).toEqual(['id', 'name'])
		expect(scopes[0].sourceExpr).toBe('users')
	})

	it('should return empty array for no for loop', () => {
		const text = `
<div>No loop here</div>
`
		const scopes = collectTemplateScopes(mockDoc, text)

		expect(scopes).toHaveLength(0)
	})
})
