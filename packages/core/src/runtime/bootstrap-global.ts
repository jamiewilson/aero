/**
 * Shared globalThis bootstrap helpers for client runtimes.
 */

type RuntimeGlobal = Record<string, unknown>

function runtimeGlobal(): RuntimeGlobal {
	return globalThis as unknown as RuntimeGlobal
}

export function readBootstrappedGlobal<T extends object>(key: string): T | null {
	const value = runtimeGlobal()[key]
	if (!value || typeof value !== 'object') return null
	return value as T
}

export function getOrCreateGlobal<T extends object>(key: string, factory: () => T): T {
	const existing = readBootstrappedGlobal<T>(key)
	if (existing) return existing
	const created = factory()
	runtimeGlobal()[key] = created
	return created
}

export function deleteBootstrappedGlobal(key: string): void {
	delete runtimeGlobal()[key]
}
