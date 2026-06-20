import { AERO_ATTR_PREFIX, DATA_AERO_ATTR_PREFIX } from './constants'
import { normalizeRuntimeDirectiveName } from './runtime-directive-attributes'

export interface ParsedEventDirective {
	canonicalName: string
	event: string
	modifiers: string[]
}

export type EventDirectiveParseResult =
	| { kind: 'ok'; directive: ParsedEventDirective }
	| { kind: 'invalid'; message: string }
	| { kind: 'non-event' }

function stripPrefix(name: string): string {
	if (name.startsWith(DATA_AERO_ATTR_PREFIX)) return name.slice(DATA_AERO_ATTR_PREFIX.length)
	if (name.startsWith(AERO_ATTR_PREFIX)) return name.slice(AERO_ATTR_PREFIX.length)
	return name
}

export function parseEventDirectiveName(attrName: string): EventDirectiveParseResult {
	const normalized = normalizeRuntimeDirectiveName(attrName)
	if (!normalized || normalized.family !== 'event') {
		return { kind: 'non-event' }
	}

	const stripped = stripPrefix(attrName.trim())

	if (stripped.startsWith('on:')) {
		const body = stripped.slice(3)
		if (!body) {
			return { kind: 'invalid', message: 'Event directive must include an event name (e.g. on:click).' }
		}
		if (body.startsWith('.') || body.endsWith('.') || body.includes('..')) {
			return {
				kind: 'invalid',
				message: 'Event directive has malformed modifier chain (empty modifier segment).',
			}
		}
		const [event, ...modifiers] = body.split('.')
		if (!event) {
			return { kind: 'invalid', message: 'Event directive must include an event name.' }
		}
		if (modifiers.some(mod => !mod)) {
			return {
				kind: 'invalid',
				message: 'Event directive has malformed modifier chain (empty modifier segment).',
			}
		}
		return {
			kind: 'ok',
			directive: {
				canonicalName: normalized.canonicalName,
				event,
				modifiers,
			},
		}
	}

	const tokens = normalized.tokens
	if (tokens.length < 2 || !tokens[1]) {
		return {
			kind: 'invalid',
			message: 'Event directive must include an event name (e.g. on:click).',
		}
	}

	return {
		kind: 'ok',
		directive: {
			canonicalName: normalized.canonicalName,
			event: tokens[1],
			modifiers: tokens.slice(2),
		},
	}
}
