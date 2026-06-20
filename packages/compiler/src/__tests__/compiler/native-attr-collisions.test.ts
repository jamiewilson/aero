/**
 * Bare Aero directive names (`for`, `switch`, `default`) collide with real HTML attributes
 * (`<label for>`, `<input switch>`, `<track default>`). These must pass through untouched; only
 * the directive-shaped usage (braced value, or switch-branch context) is treated as Aero.
 *
 * `data-` prefixed forms are always explicit directives and keep failing loud on misuse.
 */

import { describe, it, expect } from 'vitest'
import { parse } from '../../parser'
import { compile } from '../../codegen'

const opts = { root: '/', resolvePath: (v: string) => v, importer: '/' }

function compileBody(html: string): string {
	const full = `<script is:build>const ok = true, xs = [1], email = ''</script>${html}`
	return compile(parse(full), opts)
}

describe('native HTML attribute collisions (bare directive passthrough)', () => {
	describe('for (collides with <label for>, <output for>)', () => {
		it('passes through bare non-braced for on <label>', () => {
			const code = compileBody('<label for="email">Email</label>')
			expect(code).toContain('<label for="email">')
		})

		it('passes through bare non-braced for on <output>', () => {
			const code = compileBody('<output for="a b">x</output>')
			expect(code).toContain('<output for="a b">')
		})

		it('still treats braced bare for as a loop directive', () => {
			const code = compileBody('<li for="{ const x of xs }">{ x }</li>')
			expect(code).toContain('<li>')
			expect(code).not.toContain('for="')
		})

		it('still fails loud on explicit for without braces', () => {
			expect(() => compileBody('<li for="email">x</li>')).toThrow(
				'Directive `for` on <li> must use a braced expression'
			)
		})

		it('still fails loud on a forgotten-brace loop (bare for on a non-native element)', () => {
			expect(() => compileBody('<li for="const item of items">x</li>')).toThrow(
				'Directive `for` on <li> must use a braced expression'
			)
		})
	})

	describe('switch (collides with <input switch>)', () => {
		it('passes through bare boolean switch on <input>', () => {
			const code = compileBody('<input type="checkbox" switch>')
			expect(code).toContain('switch')
			expect(code).toContain('<input')
		})

		it('still treats braced bare switch as a switch directive', () => {
			const code = compileBody(
				'<div switch="{ ok }"><span case="active">a</span><span default>d</span></div>'
			)
			expect(code).not.toContain('switch="')
		})

		it('still fails loud on explicit aero-switch without braces', () => {
			expect(() =>
				compileBody('<div aero-switch="status"><span default>d</span></div>')
			).toThrow('must use a braced expression')
		})

		it('still fails loud on a bare boolean switch on a non-native element', () => {
			expect(() => compileBody('<div switch>x</div>')).toThrow('must use a braced expression')
		})
	})

	describe('default (collides with <track default>)', () => {
		it('passes through bare boolean default on <track> outside a switch', () => {
			// Aero serializes boolean attributes with an empty value (same as `disabled=""`).
			const code = compileBody('<video><track default></video>')
			expect(code).toContain('<track default="">')
		})

		it('still treats default as a switch fallback inside a switch container', () => {
			const code = compileBody('<div switch="{ ok }"><span default>fallback</span></div>')
			expect(code).toContain('fallback')
			expect(code).not.toMatch(/<span default>/)
		})

		it('fails loud on explicit aero-default outside a switch', () => {
			expect(() => compileBody('<span aero-default>x</span>')).toThrow(
				'must be direct children of an element with `switch`'
			)
		})

		it('fails loud on a bare default on a non-track element outside a switch', () => {
			expect(() => compileBody('<span default>x</span>')).toThrow(
				'must be direct children of an element with `switch`'
			)
		})
	})

	describe('name (must remain a plain attribute, never a directive)', () => {
		it('passes through name on <input>', () => {
			const code = compileBody('<input name="email">')
			expect(code).toContain('name="email"')
		})
	})

	describe('non-native directive names stay claimed (fail loud)', () => {
		it('bare case outside a switch is still an error', () => {
			expect(() => compileBody('<span case="active">x</span>')).toThrow(
				'must be direct children of an element with `switch`'
			)
		})
	})
})
