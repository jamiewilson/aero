/** True for non-null objects that are not arrays. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
