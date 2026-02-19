import { describe, it, expect, vi } from 'vitest'
import { collectTemplateReferences, collectDefinedVariables } from '../analyzer'

// Mock vscode.Range and Position since they are classes
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
})

describe('collectDefinedVariables', () => {
	const mockDoc = {
		positionAt: (offset: number) => ({ line: 0, character: offset }),
	} as any

	it('should correctly parse named imports', () => {
		const text = `import { foo, bar } from 'pkg'`
		const vars = collectDefinedVariables(mockDoc, text)

		expect(vars.has('foo')).toBe(true)
		expect(vars.get('foo')?.kind).toBe('import')
		expect(vars.has('bar')).toBe(true)
		expect(vars.get('bar')?.kind).toBe('import')

		expect(vars.has('foo, bar')).toBe(false)
	})
})
