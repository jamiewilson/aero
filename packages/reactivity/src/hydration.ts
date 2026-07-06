export interface HydrationRoot {
	querySelector(selector: string): { textContent?: string | null } | null
}

const AERO_MAP = 'Map'
const AERO_SET = 'Set'

interface AeroMapPayload {
	readonly __aero: typeof AERO_MAP
	readonly entries: ReadonlyArray<readonly [unknown, unknown]>
}

interface AeroSetPayload {
	readonly __aero: typeof AERO_SET
	readonly values: readonly unknown[]
}

function isAeroMapPayload(value: unknown): value is AeroMapPayload {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as AeroMapPayload).__aero === AERO_MAP &&
		Array.isArray((value as AeroMapPayload).entries)
	)
}

function isAeroSetPayload(value: unknown): value is AeroSetPayload {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as AeroSetPayload).__aero === AERO_SET &&
		Array.isArray((value as AeroSetPayload).values)
	)
}

export function reviveStateValue(value: unknown): unknown {
	if (isAeroMapPayload(value)) {
		return new Map(value.entries.map(([k, v]) => [reviveStateValue(k), reviveStateValue(v)]))
	}
	if (isAeroSetPayload(value)) {
		return new Set(value.values.map(reviveStateValue))
	}
	if (Array.isArray(value)) {
		return value.map(reviveStateValue)
	}
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {}
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = reviveStateValue(v)
		}
		return out
	}
	return value
}

const AERO_JSON_SCRIPT_TYPE = 'application/json'
const AERO_JSON_ROLE_STATE = 'state'

function aeroJsonScriptRoleSelector(role: string): string {
	return `script[type="${AERO_JSON_SCRIPT_TYPE}"][data-aero="${role}"]`
}

function parseAeroJsonPayload(text: string): Record<string, unknown> {
	if (!text) return {}
	try {
		const parsed = JSON.parse(text)
		if (!parsed || typeof parsed !== 'object') return {}
		const revived: Record<string, unknown> = {}
		for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
			revived[k] = reviveStateValue(v)
		}
		return revived
	} catch {
		return {}
	}
}

/** Read and revive a role-specific Aero JSON script payload from the document or a root node. */
export function readAeroJsonPayload(
	role: typeof AERO_JSON_ROLE_STATE,
	root?: HydrationRoot
): Record<string, unknown> {
	const fallbackRoot =
		root ??
		((globalThis as unknown as { document?: HydrationRoot }).document &&
			(globalThis as unknown as { document?: HydrationRoot }).document)
	if (!fallbackRoot) return {}
	const el = fallbackRoot.querySelector(aeroJsonScriptRoleSelector(role))
	if (!el) return {}
	return parseAeroJsonPayload(el.textContent?.trim() || '{}')
}

export function readHydrationState(root?: HydrationRoot): Record<string, unknown> {
	return readAeroJsonPayload(AERO_JSON_ROLE_STATE, root)
}
