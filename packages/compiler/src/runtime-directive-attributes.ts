import { AERO_ATTR_PREFIX, DATA_AERO_ATTR_PREFIX } from './constants'

export type RuntimeDirectiveFamily = 'event' | 'binding'

export interface NormalizedRuntimeDirective {
	family: RuntimeDirectiveFamily
	rawName: string
	canonicalName: string
	canonicalBareName: string
	tokens: string[]
}

const SIMPLE_RUNTIME_DIRECTIVES = new Set(['busy', 'text', 'html', 'show', 'state'])

function stripRuntimePrefix(name: string): string {
	if (name.startsWith(DATA_AERO_ATTR_PREFIX)) return name.slice(DATA_AERO_ATTR_PREFIX.length)
	if (name.startsWith(AERO_ATTR_PREFIX)) return name.slice(AERO_ATTR_PREFIX.length)
	return name
}

function canonicalizeDirectiveBody(body: string): string {
	return body.replace(/[:.]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '')
}

function isRuntimeBareName(bareName: string): boolean {
	if (!bareName) return false
	if (SIMPLE_RUNTIME_DIRECTIVES.has(bareName)) return true
	if (bareName.startsWith('on-') && bareName.length > 3) return true
	if (bareName.startsWith('class-') && bareName.length > 6) return true
	if (bareName.startsWith('computed-') && bareName.length > 9) return true
	if (bareName.startsWith('value-') && bareName.length > 6) return true
	if (bareName.startsWith('checked-') && bareName.length > 8) return true
	return false
}

export function normalizeRuntimeDirectiveName(rawName: string): NormalizedRuntimeDirective | null {
	const trimmed = rawName.trim()
	if (!trimmed) return null

	const bare = stripRuntimePrefix(trimmed)
	const canonicalBareName = canonicalizeDirectiveBody(bare)
	if (!isRuntimeBareName(canonicalBareName)) return null

	const tokens = canonicalBareName.split('-').filter(Boolean)
	const family: RuntimeDirectiveFamily = canonicalBareName.startsWith('on-') ? 'event' : 'binding'

	return {
		family,
		rawName: rawName,
		canonicalName: `${DATA_AERO_ATTR_PREFIX}${canonicalBareName}`,
		canonicalBareName,
		tokens,
	}
}
