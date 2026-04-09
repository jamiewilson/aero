import { describe, it, expect } from 'vitest'
import { aeroIdeDocHref, aeroIdeDocsUrlForCode } from '../ide-catalog'

describe('ide-catalog', () => {
	it('aeroIdeDocHref joins repo docs path', () => {
		expect(aeroIdeDocHref('interpolation.md')).toBe(
			'https://github.com/jamiewilson/aero/blob/main/docs/drafts/interpolation.md'
		)
	})

	it('aeroIdeDocsUrlForCode maps stable codes', () => {
		expect(aeroIdeDocsUrlForCode('AERO_BUILD_SCRIPT')).toContain('script-taxonomy.md')
		expect(aeroIdeDocsUrlForCode('AERO_RESOLVE')).toContain('importing-and-bundling.md')
		expect(aeroIdeDocsUrlForCode('AERO_TEMPLATE')).toContain('html-template-element.md')
		expect(aeroIdeDocsUrlForCode('AERO_SWITCH')).toContain('html-template-element.md')
	})
})
