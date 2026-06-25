export interface HydrationRoot {
	querySelector(selector: string): { textContent?: string | null } | null
}

export function readHydrationState(root?: HydrationRoot): Record<string, unknown> {
	const fallbackRoot =
		root ??
		((globalThis as unknown as { document?: HydrationRoot }).document &&
			(globalThis as unknown as { document?: HydrationRoot }).document)
	if (!fallbackRoot) return {}
	const el = fallbackRoot.querySelector('script[type="aero/state"]')
	if (!el) return {}
	const text = el.textContent?.trim() || '{}'
	if (!text) return {}
	try {
		const parsed = JSON.parse(text)
		return parsed && typeof parsed === 'object' ? parsed : {}
	} catch {
		return {}
	}
}
