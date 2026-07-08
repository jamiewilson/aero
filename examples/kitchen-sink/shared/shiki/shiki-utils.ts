import type { ThemeRegistrationAny } from 'shiki'

export function scopeMatches(scope: string | string[] | undefined, targets: string[]): boolean {
	if (scope == null) return false
	const scopes = Array.isArray(scope) ? scope : [scope]
	return scopes.some(s =>
		targets.some(t => s === t || s.startsWith(t + '.') || s.endsWith('.' + t))
	)
}

export function applyOverrides(
	base: unknown,
	...overrides: Array<(theme: ThemeRegistrationAny) => ThemeRegistrationAny>
): ThemeRegistrationAny {
	return overrides.reduce((acc, fn) => fn(acc), base as ThemeRegistrationAny)
}
