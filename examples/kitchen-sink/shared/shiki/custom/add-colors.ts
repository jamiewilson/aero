import type { ThemeRegistrationAny } from 'shiki'
import { scopeMatches } from './scope-matches'

const SCOPE_COLOR_OVERRIDES = [
	{
		scopes: ['comment', 'punctuation.definition.comment'],
		foreground: 'var(--code-comment)',
	},
]

/**
 * Wire Shiki theme colors to CSS variables defined in code.css.
 *
 * @remarks
 * - Comment scopes use `--code-comment`.
 * - Block background uses `--code-bg` via `editor.background` on `<pre class="shiki">`.
 */
export function addColors(theme: ThemeRegistrationAny): ThemeRegistrationAny {
	const base = JSON.parse(JSON.stringify(theme)) as ThemeRegistrationAny
	const tokenColors = base.tokenColors ?? []

	const commentColors = tokenColors.map(entry => {
		const override = SCOPE_COLOR_OVERRIDES.find(({ scopes }) =>
			scopeMatches(entry.scope, [...scopes])
		)
		if (!override) return entry

		return {
			...entry,
			settings: {
				...entry.settings,
				foreground: override.foreground,
			},
		}
	})

	return {
		...base,
		tokenColors: commentColors,
		colors: {
			...base.colors,
			'editor.background': 'var(--code-bg)',
		},
	}
}
