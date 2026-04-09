import { describe, it, expect } from 'vitest'
import { aeroIdeDocHref, aeroIdeDocsUrlForCode } from '../ide-catalog'

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
})
