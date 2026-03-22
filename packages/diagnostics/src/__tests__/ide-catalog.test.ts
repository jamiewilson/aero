import { describe, it, expect } from 'vitest'
import { aeroIdeDocHref, aeroIdeDocsUrlForCode } from '../ide-catalog'

describe('ide-catalog', () => {
	it('aeroIdeDocHref joins repo docs path', () => {
		expect(aeroIdeDocHref('interpolation.md')).toBe(
			'https://github.com/jamiewilson/aero/blob/main/docs/interpolation.md'
		)
	})

	it('aeroIdeDocsUrlForCode maps stable codes', () => {
		expect(aeroIdeDocsUrlForCode('AERO_BUILD_SCRIPT')).toContain('script-taxonomy.md')
		expect(aeroIdeDocsUrlForCode('AERO_RESOLVE')).toContain('importing-and-bundling.md')
	})
})
