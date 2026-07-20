import { describe, it, expect } from 'vitest'
import {
	aeroIdeDocHref,
	aeroIdeDocsUrlForCode,
	aeroIdeDocsUrlForDiagnostic,
} from '../ide-catalog'

describe('ide-catalog', () => {
	it('aeroIdeDocHref joins repo docs path', () => {
		expect(aeroIdeDocHref('getting-started/templates.mdx')).toBe(
			'https://github.com/jamiewilson/aero/blob/main/docs/getting-started/templates.mdx'
		)
	})

	it('aeroIdeDocsUrlForCode maps stable codes', () => {
		expect(aeroIdeDocsUrlForCode('AERO_BUILD_SCRIPT')).toContain('getting-started/scripts.mdx')
		expect(aeroIdeDocsUrlForCode('AERO_RESOLVE')).toContain('guide/importing-and-bundling.mdx')
		expect(aeroIdeDocsUrlForCode('AERO_TEMPLATE')).toContain('guide/html-template.mdx')
		expect(aeroIdeDocsUrlForCode('AERO_SWITCH')).toContain('guide/html-template.mdx')
	})

	it('maps diagnostic-specific docs to canonical MDX pages', () => {
		expect(
			aeroIdeDocsUrlForDiagnostic({
				code: 'AERO_COMPILE',
				message: "Missing required prop 'title'",
			})
		).toContain('getting-started/templates.mdx')
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
		).toContain('getting-started/scripts.mdx')
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
