export interface PersistOptions {
	readonly storage?: 'local' | 'session'
	readonly sync?: boolean
	readonly critical?: boolean
	readonly attribute?: string
}

export type AeroPersistFn = <T>(key: string, fallback: T, options?: PersistOptions) => T

export function namespacePersistKey(key: string): string {
	return `aero:${key}`
}

let storageUnavailableWarned = false
let nonJsonWriteWarned = false

function warnStorageUnavailable(): void {
	if (storageUnavailableWarned) return
	storageUnavailableWarned = true
	console.warn('[aero] Browser storage is unavailable; persist bindings will use defaults only.')
}

function warnNonJsonWrite(): void {
	if (nonJsonWriteWarned) return
	nonJsonWriteWarned = true
	console.warn('[aero] Persist only supports JSON-serializable values; skipping write.')
}

function resolveStorage(options?: PersistOptions): Storage | null {
	if (typeof window === 'undefined') return null
	try {
		const kind = options?.storage ?? 'local'
		return kind === 'session' ? window.sessionStorage : window.localStorage
	} catch {
		return null
	}
}

/** Sync read from namespaced storage; corrupt or missing values return fallback. */
export function readPersistedValue<T>(key: string, fallback: T, options?: PersistOptions): T {
	const storage = resolveStorage(options)
	if (!storage) return fallback
	try {
		const raw = storage.getItem(namespacePersistKey(key))
		if (raw === null) return fallback
		return JSON.parse(raw) as T
	} catch {
		return fallback
	}
}

function writePersistedValue(key: string, value: unknown, options?: PersistOptions): void {
	const storage = resolveStorage(options)
	if (!storage) {
		warnStorageUnavailable()
		return
	}
	try {
		const serialized = JSON.stringify(value)
		if (serialized === undefined) {
			warnNonJsonWrite()
			return
		}
		storage.setItem(namespacePersistKey(key), serialized)
	} catch {
		warnStorageUnavailable()
	}
}

export interface PersistBinding<T> {
	readonly initial: T
	attach(signal: { value: T; subscribe(cb: (value: T) => void): () => void }): () => void
}

/** Create initial value + writer/sync listeners for a persisted owned signal. */
export function createPersistBinding<T>(
	key: string,
	fallback: T,
	options?: PersistOptions
): PersistBinding<T> {
	const initial = readPersistedValue(key, fallback, options)
	return {
		initial,
		attach(signal) {
			const unsubWrite = signal.subscribe(value => {
				writePersistedValue(key, value, options)
			})
			if (!options?.sync || typeof window === 'undefined') {
				return unsubWrite
			}
			const onStorage = (event: StorageEvent) => {
				if (event.storageArea !== resolveStorage(options)) return
				if (event.key !== namespacePersistKey(key)) return
				if (event.newValue === null) {
					signal.value = fallback
					return
				}
				try {
					signal.value = JSON.parse(event.newValue) as T
				} catch {
					signal.value = fallback
				}
			}
			window.addEventListener('storage', onStorage)
			return () => {
				unsubWrite()
				window.removeEventListener('storage', onStorage)
			}
		},
	}
}

export function createAeroPersist(): AeroPersistFn {
	return (key, fallback, options) => {
		return createPersistBinding(key, fallback, options).initial
	}
}

export function attachPersistWriter(
	signal: { value: unknown; subscribe(cb: (value: unknown) => void): () => void },
	metadata: {
		readonly key: string
		readonly storage?: 'local' | 'session'
		readonly sync?: boolean
	}
): () => void {
	return createPersistBinding(metadata.key, signal.value, {
		storage: metadata.storage,
		sync: metadata.sync,
	}).attach(signal as { value: unknown; subscribe(cb: (value: unknown) => void): () => void })
}
