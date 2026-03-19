/** TextMate theme shape used by Shiki. */
export interface ShikiTheme {
	tokenColors?: Array<{ scope: string | string[]; settings?: Record<string, unknown> }>
	colors?: Record<string, string>
	name?: string
	[key: string]: unknown
}

export function scopeMatches(scope: string | string[] | undefined, targets: string[]): boolean {
	if (scope == null) return false
	const scopes = Array.isArray(scope) ? scope : [scope]
	return scopes.some(s =>
		targets.some(t => s === t || s.startsWith(t + '.') || s.endsWith('.' + t))
	)
}

export function applyOverrides(
	base: unknown,
	...overrides: Array<(theme: ShikiTheme) => ShikiTheme>
): ShikiTheme {
	return overrides.reduce((acc, fn) => fn(acc), base as ShikiTheme)
}
