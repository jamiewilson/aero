import githubLight from '@shikijs/themes/github-light'
import githubDarkHighContrast from '@shikijs/themes/github-dark-high-contrast'

/** TextMate theme shape used by Shiki. */
interface ShikiTheme {
	tokenColors?: Array<{ scope: string | string[]; settings?: Record<string, unknown> }>
	colors?: Record<string, string>
	name?: string
	[key: string]: unknown
}

function scopeMatchesComment(scope: string | string[]): boolean {
	const scopes = Array.isArray(scope) ? scope : [scope]
	return scopes.some(s => s.startsWith('comment') || s.includes('comment'))
}

/**
 * Clone a Shiki theme and add fontStyle: italic to comment token colors.
 */
function withItalicComments(theme: ShikiTheme): ShikiTheme {
	const base = JSON.parse(JSON.stringify(theme)) as ShikiTheme
	const tokenColors = base.tokenColors ?? []

	const updated = tokenColors.map(entry => {
		if (!scopeMatchesComment(entry.scope)) return entry
		return {
			...entry,
			settings: {
				...entry.settings,
				foreground: '#636e7b',
				fontStyle: 'italic',
			},
		}
	})

	return { ...base, tokenColors: updated }
}

export const customLightTheme = withItalicComments(githubLight as ShikiTheme)
export const customDarkTheme = withItalicComments(githubDarkHighContrast as ShikiTheme)
