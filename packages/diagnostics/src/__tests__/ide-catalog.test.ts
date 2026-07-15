import { describe, it, expect } from 'vitest'
import {
	aeroIdeDocHref,
	aeroIdeDocsUrlForCode,
	aeroIdeDocsUrlForDiagnostic,
} from '../ide-catalog'

describe('ide-catalog', () => {
	it('aeroIdeDocHref joins repo docs path', () => {
		expect(aeroIdeDocHref('concepts/templating.mdx')).toBe(
			'https://github.com/jamiewilson/aero/blob/main/docs/concepts/templating.mdx'
		)
	})

	it('aeroIdeDocsUrlForCode maps stable codes', () => {
		expect(aeroIdeDocsUrlForCode('AERO_BUILD_SCRIPT')).toContain('concepts/scripts.mdx')
		expect(aeroIdeDocsUrlForCode('AERO_RESOLVE')).toContain('guide/importing-and-bundling.mdx')
		expect(aeroIdeDocsUrlForCode('AERO_TEMPLATE')).toContain('concepts/html-template.mdx')
		expect(aeroIdeDocsUrlForCode('AERO_SWITCH')).toContain('concepts/html-template.mdx')
	})

	it('maps diagnostic-specific docs to canonical MDX pages', () => {
		expect(
			aeroIdeDocsUrlForDiagnostic({
				code: 'AERO_COMPILE',
				message: "Missing required prop 'title'",
			})
		).toContain('data/props.mdx')
		expect(
			aeroIdeDocsUrlForDiagnostic({
				code: 'AERO_COMPILE',
				message: 'Reactive prop `count` is readonly',
			})
		).toContain('getting-started/reactivity.mdx')
		expect(
			aeroIdeDocsUrlForDiagnostic({
				code: 'AERO_BUILD_SCRIPT',
				message: 'Type error',
			})
		).toContain('concepts/scripts.mdx')
	})

	it('preserves an explicit diagnostic docs URL', () => {
		expect(
			aeroIdeDocsUrlForDiagnostic({
				code: 'AERO_COMPILE',
				message: 'bad',
				docsUrl: 'https://example.com/aero-error',
			})
		).toBe('https://example.com/aero-error')
	})
})
