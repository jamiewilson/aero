import { describe, expect, it } from 'vitest'
import { isSwappableFragmentHtml } from '../fragment-html'

describe('isSwappableFragmentHtml', () => {
	it('accepts ordinary fragments', () => {
		expect(isSwappableFragmentHtml('<span>not found</span>')).toBe(true)
		expect(isSwappableFragmentHtml('<div class="error">422</div>')).toBe(true)
		expect(isSwappableFragmentHtml('plain text')).toBe(true)
		expect(isSwappableFragmentHtml('')).toBe(true)
	})

	it('rejects full documents', () => {
		expect(isSwappableFragmentHtml('<!DOCTYPE html><html><body>err</body></html>')).toBe(false)
		expect(isSwappableFragmentHtml('<!doctype html><html lang="en">')).toBe(false)
		expect(isSwappableFragmentHtml('<html><head></head><body></body></html>')).toBe(false)
		expect(isSwappableFragmentHtml('  \n<html class="youch">')).toBe(false)
	})

	it('rejects Aero overlay-bootstrap shells', () => {
		expect(
			isSwappableFragmentHtml('<div data-aero-overlay-bootstrap>overlay</div>')
		).toBe(false)
		expect(
			isSwappableFragmentHtml('<html lang="en" data-aero-overlay-bootstrap>')
		).toBe(false)
	})
})
