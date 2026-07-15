import type { ThemeRegistrationAny } from 'shiki'
import { scopeMatches } from './scope-matches'

const ITALIC_SCOPES = [
	'comment',
	'punctuation.definition.comment',
	'entity.name.type.class',
	'keyword',
	'storage.modifier',
	'storage.type',
	'support.class.builtin',
	'keyword.control',
	'constant.language',
	'entity.other.attribute-name',
	'entity.name.method',
]

/**
 * Clone a Shiki theme and add fontStyle: italic to token colors matching ITALIC_SCOPES.
 * Also adds new rules for scopes in ITALIC_SCOPES that the base theme doesn't define
 * (e.g. entity.other.attribute-name for HTML attributes), so they work in the browser.
 */
export function addItalics(theme: ThemeRegistrationAny): ThemeRegistrationAny {
	const base = JSON.parse(JSON.stringify(theme)) as ThemeRegistrationAny
	const tokenColors = base.tokenColors ?? []

	const updated = tokenColors.map(entry => {
		if (!scopeMatches(entry.scope, ITALIC_SCOPES)) return entry
		return {
			...entry,
			settings: {
				...entry.settings,
				fontStyle: 'italic',
			},
		}
	})

	// Add rules for ITALIC_SCOPES not covered by the base theme (e.g. HTML attributes)
	const coveredScopes = new Set<string>()

	for (const entry of tokenColors) {
		for (const s of ITALIC_SCOPES) {
			if (scopeMatches(entry.scope, [s])) coveredScopes.add(s)
		}
	}

	for (const scope of ITALIC_SCOPES) {
		if (coveredScopes.has(scope)) continue
		updated.push({ scope: [scope], settings: { fontStyle: 'italic' } })
	}

	return { ...base, tokenColors: updated }
}
