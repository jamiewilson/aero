import { describe, expect, it } from 'vitest'
import { Signal } from '../signal'

describe('Signal', () => {
	it('reads and writes value', () => {
		const s = new Signal(1)
		expect(s.value).toBe(1)
		s.value = 2
		expect(s.value).toBe(2)
	})

	it('notifies subscribers on changes', () => {
		const s = new Signal(0)
		const seen: number[] = []
		const off = s.subscribe(v => seen.push(v))
		s.value = 1
		s.value = 2
		off()
		s.value = 3
		expect(seen).toEqual([1, 2])
	})
})
