/**
 * Unit tests for propsValidation: interface parsing, required props extraction.
 */
import { describe, it, expect, vi } from 'vitest'
import {
	parseInterfaceBody,
	findInterfaceInSource,
	getKeysFromObjectLiteral,
	getPropsTypeFromComponent,
} from '../propsValidation'

vi.mock('vscode', () => ({
	workspace: { getWorkspaceFolder: vi.fn() },
}))

describe('parseInterfaceBody', () => {
	it('parses required and optional props from interface body', () => {
		const body = `
			title: string;
			subtitle?: string;
			extraProp: boolean;
		`
		const result = parseInterfaceBody(body)
		expect(result.required).toEqual(['title', 'extraProp'])
		expect(result.optional).toEqual(['subtitle'])
	})

	it('parses MetaProps body', () => {
		const body = `
			title?: string
			description?: string
			image?: string
			extraProp: boolean
		`
		const result = parseInterfaceBody(body)
		expect(result.required).toEqual(['extraProp'])
		expect(result.optional).toEqual(['title', 'description', 'image'])
	})
})

describe('findInterfaceInSource', () => {
	it('finds interface and parses required props', () => {
		const source = `export interface HeaderProps {
	title: string
	subtitle?: string
	extraProp: boolean
}`
		const result = findInterfaceInSource(source, 'HeaderProps')
		expect(result).not.toBeNull()
		expect(result!.required).toEqual(['title', 'extraProp'])
		expect(result!.optional).toEqual(['subtitle'])
	})

	it('returns null for missing interface', () => {
		const source = `interface Other { x: number }`
		expect(findInterfaceInSource(source, 'HeaderProps')).toBeNull()
	})
})

describe('getKeysFromObjectLiteral', () => {
	it('extracts keys from shorthand object', () => {
		expect(getKeysFromObjectLiteral('{ title, subtitle }')).toEqual(['title', 'subtitle'])
	})

	it('extracts keys from object with values', () => {
		expect(getKeysFromObjectLiteral("{ title: 'x', subtitle: site.about.subtitle }")).toEqual([
			'title',
			'subtitle',
		])
	})
})

describe('getPropsTypeFromComponent', () => {
	it('extracts HeaderProps from component with inline interface', () => {
		const html = `<script is:build lang="ts">
	export interface HeaderProps {
		title: string
		subtitle?: string
		extraProp: boolean
	}
	const props = Aero.props as HeaderProps
</script>
<header></header>`
		const result = getPropsTypeFromComponent(html)
		expect(result).toEqual({ typeName: 'HeaderProps', isFromDestructuring: false })
	})

	it('extracts MetaProps from destructuring', () => {
		const html = `<script is:build lang="ts">
	import type { MetaProps } from '@content/types/props'
	const { title, description, image } = Aero.props as MetaProps
</script>
<meta />`
		const result = getPropsTypeFromComponent(html)
		expect(result).toEqual({ typeName: 'MetaProps', isFromDestructuring: true })
	})
})
