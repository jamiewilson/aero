import { describe, expect, it } from 'vitest'
import { AeroCompileError } from '../tagged-errors'
import { isAeroOwnedFailure, viteLoggerHasColors } from '../ownership'

describe('isAeroOwnedFailure', () => {
	it('owns AeroCompileError, CssSyntaxError, plugin-tagged, and [AERO_*] messages', () => {
		expect(isAeroOwnedFailure(new AeroCompileError({ message: 'x' }))).toBe(true)
		const css = new Error('css')
		css.name = 'CssSyntaxError'
		expect(isAeroOwnedFailure(css)).toBe(true)
		expect(
			isAeroOwnedFailure(
				Object.assign(new Error('boom'), { plugin: 'vite-plugin-aero-transform' })
			)
		).toBe(true)
		expect(isAeroOwnedFailure(new Error('[AERO_COMPILE] boom'))).toBe(true)
		expect(
			isAeroOwnedFailure({
				message: 'Hypermedia actions must be imported',
				plugin: 'vite-plugin-aero-transform',
			})
		).toBe(true)
		expect(isAeroOwnedFailure(new Error('plain'))).toBe(false)
		expect(isAeroOwnedFailure('string')).toBe(false)
	})
})

describe('viteLoggerHasColors', () => {
	it('forwards only explicit booleans', () => {
		expect(viteLoggerHasColors({ hasColors: true })).toBe(true)
		expect(viteLoggerHasColors({ hasColors: false })).toBe(false)
		expect(viteLoggerHasColors({})).toBeUndefined()
		expect(viteLoggerHasColors({ hasColors: 'yes' })).toBeUndefined()
	})
})
