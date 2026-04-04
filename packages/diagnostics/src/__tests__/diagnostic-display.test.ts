import { describe, expect, it } from 'vitest'
import { bannerTitleForCode, DIAGNOSTIC_BANNER_CHAR, makeBanner } from '../diagnostic-display'

describe('diagnostic-display', () => {
	it('makeBanner centers title between repeat characters', () => {
		const { header, footer } = makeBanner('Aero Compiler Error', { minWidth: 35 })
		expect(header).toContain('Aero Compiler Error')
		expect(header.startsWith(DIAGNOSTIC_BANNER_CHAR)).toBe(true)
		expect(footer.length).toBeGreaterThanOrEqual(35)
		expect(footer).toMatch(new RegExp(`^${DIAGNOSTIC_BANNER_CHAR}+$`))
	})

	it('makeBanner respects custom char', () => {
		const { header, footer } = makeBanner('x', { minWidth: 10, char: '-' })
		expect(header).toMatch(/^--+ x --+$/)
		expect(footer).toMatch(/^-+$/)
	})

	it('bannerTitleForCode maps stable codes', () => {
		expect(bannerTitleForCode('AERO_COMPILE')).toBe('Aero Compiler Error')
		expect(bannerTitleForCode('AERO_CONTENT_SCHEMA')).toBe('Aero Content Schema Error')
	})
})
