import { describe, expect, it } from 'vitest'
import { normalizeRuntimeDirectiveName } from '../../runtime-directive-attributes'

describe('normalizeRuntimeDirectiveName', () => {
	it('canonicalizes event directives from bare and prefixed forms', () => {
		expect(normalizeRuntimeDirectiveName('on:click.prevent')).toMatchObject({
			family: 'event',
			canonicalName: 'data-aero-on-click-prevent',
			canonicalBareName: 'on-click-prevent',
			tokens: ['on', 'click', 'prevent'],
		})

		expect(normalizeRuntimeDirectiveName('aero-on:submit.stop')).toMatchObject({
			canonicalName: 'data-aero-on-submit-stop',
		})

		expect(normalizeRuntimeDirectiveName('data-aero-on-keydown-enter')).toMatchObject({
			canonicalName: 'data-aero-on-keydown-enter',
		})
	})

	it('canonicalizes binding directives', () => {
		expect(normalizeRuntimeDirectiveName('busy')).toMatchObject({
			family: 'binding',
			canonicalName: 'data-aero-busy',
		})

		expect(normalizeRuntimeDirectiveName('class:is-active')).toMatchObject({
			canonicalName: 'data-aero-class-is-active',
		})

		expect(normalizeRuntimeDirectiveName('computed:total')).toMatchObject({
			canonicalName: 'data-aero-computed-total',
		})
	})

	it('returns null for non-runtime attributes', () => {
		expect(normalizeRuntimeDirectiveName('href')).toBeNull()
		expect(normalizeRuntimeDirectiveName('aero-props')).toBeNull()
		expect(normalizeRuntimeDirectiveName('data-foo')).toBeNull()
	})
})
