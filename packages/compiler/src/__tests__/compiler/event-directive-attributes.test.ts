import { describe, expect, it } from 'vitest'
import { parseEventDirectiveName } from '../../event-directive-attributes'

describe('parseEventDirectiveName', () => {
	it('parses authoring form with modifiers', () => {
		const parsed = parseEventDirectiveName('on:submit.prevent.stop')
		expect(parsed.kind).toBe('ok')
		if (parsed.kind !== 'ok') return
		expect(parsed.directive).toEqual({
			canonicalName: 'data-aero-on-submit-prevent-stop',
			event: 'submit',
			modifiers: ['prevent', 'stop'],
		})
	})

	it('parses canonical form', () => {
		const parsed = parseEventDirectiveName('data-aero-on-click-prevent')
		expect(parsed.kind).toBe('ok')
		if (parsed.kind !== 'ok') return
		expect(parsed.directive.event).toBe('click')
		expect(parsed.directive.modifiers).toEqual(['prevent'])
	})

	it('returns invalid for malformed modifier chain', () => {
		const parsed = parseEventDirectiveName('on:click..prevent')
		expect(parsed.kind).toBe('invalid')
		if (parsed.kind !== 'invalid') return
		expect(parsed.message).toContain('malformed modifier chain')
	})

	it('returns non-event for non-event attrs', () => {
		expect(parseEventDirectiveName('busy')).toEqual({ kind: 'non-event' })
		expect(parseEventDirectiveName('href')).toEqual({ kind: 'non-event' })
	})
})
