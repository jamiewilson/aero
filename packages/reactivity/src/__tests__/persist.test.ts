import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	attachPersistWriter,
	createAeroPersist,
	createPersistBinding,
	namespacePersistKey,
	readPersistedValue,
} from '../persist'
import { Signal } from '../signal'

class MemoryStorage implements Storage {
	private map = new Map<string, string>()
	get length() {
		return this.map.size
	}
	clear() {
		this.map.clear()
	}
	getItem(key: string) {
		return this.map.get(key) ?? null
	}
	key(index: number) {
		return [...this.map.keys()][index] ?? null
	}
	removeItem(key: string) {
		this.map.delete(key)
	}
	setItem(key: string, value: string) {
		this.map.set(key, value)
	}
}

describe('persist', () => {
	let local: MemoryStorage
	let session: MemoryStorage

	beforeEach(() => {
		local = new MemoryStorage()
		session = new MemoryStorage()
		vi.stubGlobal('window', {
			localStorage: local,
			sessionStorage: session,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		})
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('namespaces storage keys', () => {
		expect(namespacePersistKey('theme')).toBe('aero:theme')
	})

	it('reads and writes JSON values in localStorage by default', () => {
		local.setItem('aero:count', '3')
		expect(readPersistedValue('count', 0)).toBe(3)

		const binding = createPersistBinding('count', 0)
		expect(binding.initial).toBe(3)

		const signal = new Signal(binding.initial)
		const cleanup = binding.attach(signal)
		signal.value = 5
		expect(local.getItem('aero:count')).toBe('5')
		cleanup()
	})

	it('uses sessionStorage when requested', () => {
		session.setItem('aero:sidebar', 'true')
		expect(readPersistedValue('sidebar', false, { storage: 'session' })).toBe(true)
	})

	it('returns fallback for missing, corrupt, or invalid JSON', () => {
		local.setItem('aero:bad', '{not json')
		expect(readPersistedValue('bad', 'ok')).toBe('ok')
		expect(readPersistedValue('missing', 'ok')).toBe('ok')
	})

	it('syncs cross-tab storage events when enabled', () => {
		const binding = createPersistBinding('draft', '', { sync: true })
		const signal = new Signal(binding.initial)
		const cleanup = binding.attach(signal)

		const handler = vi.mocked(window.addEventListener).mock.calls.find(call => call[0] === 'storage')?.[1] as (
			event: StorageEvent
		) => void
		expect(handler).toBeTypeOf('function')

		handler({
			key: 'aero:draft',
			newValue: JSON.stringify('hello'),
			storageArea: local,
		} as StorageEvent)
		expect(signal.value).toBe('hello')

		cleanup()
		expect(window.removeEventListener).toHaveBeenCalled()
	})

	it('does not react to same-tab writes via storage event', () => {
		const binding = createPersistBinding('draft', '', { sync: true })
		const signal = new Signal(binding.initial)
		binding.attach(signal)
		signal.value = 'local'
		expect(local.getItem('aero:draft')).toBe(JSON.stringify('local'))
	})

	it('degrades when storage is unavailable', () => {
		vi.stubGlobal('window', undefined)
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const binding = createPersistBinding('x', 1)
		expect(binding.initial).toBe(1)
		const signal = new Signal(1)
		binding.attach(signal)
		signal.value = 2
		expect(warn).toHaveBeenCalled()
		warn.mockRestore()
	})

	it('exposes Aero.persist as initial-value helper', () => {
		local.setItem('aero:theme', JSON.stringify('dark'))
		const persist = createAeroPersist()
		expect(persist('theme', 'system')).toBe('dark')
		expect(persist('missing', 'system')).toBe('system')
	})

	it('attachPersistWriter wires metadata onto an existing signal', () => {
		const signal = new Signal('light')
		const cleanup = attachPersistWriter(signal, { key: 'theme' })
		signal.value = 'dark'
		expect(local.getItem('aero:theme')).toBe(JSON.stringify('dark'))
		cleanup()
	})
})
