import type { HypermediaSignalStore } from './types'

export function parseSignalPatch(body: string): Record<string, unknown> | null {
	const trimmed = body.trim()
	if (!trimmed) return null
	let parsed: unknown
	try {
		parsed = JSON.parse(trimmed)
	} catch {
		return null
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
	return parsed as Record<string, unknown>
}

export function applySignalPatch(
	store: HypermediaSignalStore | undefined,
	patch: Record<string, unknown>
): boolean {
	if (!store?.merge) return false
	store.merge(patch)
	return true
}

export function isJsonContentType(contentType: string | undefined): boolean {
	return (contentType ?? '').toLowerCase().includes('application/json')
}
