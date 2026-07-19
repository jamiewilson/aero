/**
 * Characterization tests for component-props check helpers.
 */

import { describe, expect, it } from 'vitest'
import { resolvePropsSpreadVariable } from '../checks/check-component-props'

describe('resolvePropsSpreadVariable', () => {
	it('extracts spread variable from props="{ ...name }"', () => {
		expect(resolvePropsSpreadVariable('props="{ ...card }"')).toBe('card')
		expect(resolvePropsSpreadVariable('aero-props="{ ...data }"')).toBe('data')
		expect(resolvePropsSpreadVariable('data-aero-props="{ ...item }"')).toBe('item')
	})

	it('maps bare props to local variable props', () => {
		expect(resolvePropsSpreadVariable('props')).toBe('props')
		expect(resolvePropsSpreadVariable(' class="x" props ')).toBe('props')
		expect(resolvePropsSpreadVariable('aero-props')).toBe('props')
	})

	it('returns null for individual attrs or non-spread props values', () => {
		expect(resolvePropsSpreadVariable('title="{ x }"')).toBeNull()
		expect(resolvePropsSpreadVariable('props="{ title }"')).toBeNull()
		expect(resolvePropsSpreadVariable('')).toBeNull()
	})
})
