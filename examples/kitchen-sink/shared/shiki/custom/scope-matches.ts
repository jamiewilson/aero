/**
 * Check if a scope matches a target.
 *
 * @remarks
 * - Check if a scope matches a target.
 * - The scope is an array of strings.
 * - The target is an array of strings.
 * - The scope matches the target if the scope is equal to the target, or if the scope starts with the target and a dot, or if the scope ends with a dot and the target.
 */

export function scopeMatches(scope: string | string[] | undefined, targets: string[]): boolean {
	if (scope == null) return false
	const scopes = Array.isArray(scope) ? scope : [scope]
	return scopes.some(s =>
		targets.some(t => s === t || s.startsWith(t + '.') || s.endsWith('.' + t))
	)
}
