import type { ThemeRegistrationAny } from 'shiki'
import { scopeMatches } from './shiki-utils.ts'

const COMMENT_SCOPES = ['comment', 'punctuation.definition.comment']

function scopeMatchesComment(scope: string | string[] | undefined): boolean {
	return scopeMatches(scope, COMMENT_SCOPES)
}

/**
 * Clone a Shiki theme and set foreground to `var(--shiki-comment)` for comment
 * token colors. The actual color value is defined in CSS (e.g. code.css).
 */
export function withCommentColor(theme: ThemeRegistrationAny): ThemeRegistrationAny {
	const base = JSON.parse(JSON.stringify(theme)) as ThemeRegistrationAny
	const tokenColors = base.tokenColors ?? []

	const updated = tokenColors.map(entry => {
		if (!scopeMatchesComment(entry.scope)) return entry
		return {
			...entry,
			settings: {
				...entry.settings,
				foreground: 'var(--shiki-comment)',
			},
		}
	})

	return { ...base, tokenColors: updated }
}
