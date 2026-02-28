/**
 * Unit tests for the Aero VS Code analyzer (analyzer.ts): template references (components,
 * attributes), defined variables (imports), template scopes (data-each), and variables by scope
 * (e.g. pass:data in client/bundled scope). Mocks vscode Range/Position for offset→position conversion.
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
})

/** Build-scope defined variables (imports, etc.) and pass:data variable positions in client (bundled) scope. */
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

	it('should calculate correct position for pass:data variables', () => {
		const text = `<script pass:data="{{ isHomepage }}">
	import { debug } from '@scripts/utils/debug'
</script>`
		const vars = collectVariablesByScope(mockDoc, text, 'bundled')

		expect(vars.has('isHomepage')).toBe(true)
		const varInfo = vars.get('isHomepage')
		expect(varInfo?.kind).toBe('reference')
		expect(varInfo?.range.start.character).toBe(22) // position of 'i' in "isHomepage"
		expect(varInfo?.range.end.character).toBe(32) // end of "isHomepage" (22 + 10)
	})

	it('should calculate correct position for pass:data with no spaces', () => {
		const text = `<script pass:data="{{isHomepage}}"></script>`
		const vars = collectVariablesByScope(mockDoc, text, 'bundled')

		expect(vars.has('isHomepage')).toBe(true)
		const varInfo = vars.get('isHomepage')
		expect(varInfo?.range.start.character).toBe(21) // position of 'i' in "isHomepage" (no spaces)
		expect(varInfo?.range.end.character).toBe(31)
	})

	it('should calculate correct position for multiple pass:data variables', () => {
		const text = `<script pass:data="{{ foo, bar }}"></script>`
		const vars = collectVariablesByScope(mockDoc, text, 'bundled')

		expect(vars.has('foo')).toBe(true)
		expect(vars.has('bar')).toBe(true)
		expect(vars.get('foo')?.range.start.character).toBe(22) // position of 'f' in "foo"
		expect(vars.get('bar')?.range.start.character).toBe(27) // position of 'b' in "bar"
	})
})

/** data-each / each scopes: item name and source expression; nested loops return inner-first. */
describe('collectTemplateScopes', () => {
	const mockDoc = {
		positionAt: (offset: number) => ({ line: 0, character: offset }),
	} as any

	it('should parse data-each attribute', () => {
		const text = `
<ul>
	<li data-each="{ item in items }">{item.name}</li>
</ul>
`
		const scopes = collectTemplateScopes(mockDoc, text)

		expect(scopes).toHaveLength(1)
		expect(scopes[0].itemName).toBe('item')
		expect(scopes[0].sourceExpr).toBe('items')
	})

	it('should parse shorthand each attribute', () => {
		const text = `
<ul>
	<li each="{ user in users }">{user.name}</li>
</ul>
`
		const scopes = collectTemplateScopes(mockDoc, text)

		expect(scopes).toHaveLength(1)
		expect(scopes[0].itemName).toBe('user')
		expect(scopes[0].sourceExpr).toBe('users')
	})

	it('should handle nested data-each scopes', () => {
		const text = `
<div data-each="{ category in categories }">
	<span data-each="{ item in category.items }">{item.name}</span>
</div>
`
		const scopes = collectTemplateScopes(mockDoc, text)

		expect(scopes).toHaveLength(2)
		// Scopes are returned in closing order (inner first, then outer)
		expect(scopes[0].itemName).toBe('item')
		expect(scopes[1].itemName).toBe('category')
	})

	it('should return empty array for no data-each', () => {
		const text = `
<div>No loop here</div>
`
		const scopes = collectTemplateScopes(mockDoc, text)

		expect(scopes).toHaveLength(0)
	})
})
