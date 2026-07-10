import { describe, expect, it } from 'vitest'
import { referencesStateBindingExpression } from '../../state-mount-codegen'

describe('referencesStateBindingExpression', () => {
	const names = new Set(['count', 'text', 'textOptions'])

	it('matches standalone binding identifiers', () => {
		expect(referencesStateBindingExpression('count', names)).toBe(true)
		expect(referencesStateBindingExpression('scope.text', names)).toBe(true)
		expect(referencesStateBindingExpression('{ text }', names)).toBe(true)
	})

	it('does not match binding names inside hyphenated tag names in template literals', () => {
		expect(referencesStateBindingExpression('`<numeric-text />`', names)).toBe(false)
	})

	it('does not match shorter binding names inside longer identifiers', () => {
		expect(referencesStateBindingExpression('textOptions', new Set(['text']))).toBe(false)
		expect(referencesStateBindingExpression('counter', new Set(['count']))).toBe(false)
	})

	it('still matches when the full binding name is the expression', () => {
		expect(referencesStateBindingExpression('textOptions', names)).toBe(true)
	})
})
