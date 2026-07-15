export function scopeMatches(scope: string | string[] | undefined, targets: string[]): boolean {
	if (scope == null) return false
	const scopes = Array.isArray(scope) ? scope : [scope]
	return scopes.some(s =>
		targets.some(t => s === t || s.startsWith(t + '.') || s.endsWith('.' + t))
	)
}
