import { describe, expect, it } from 'vitest'
import { Computed } from '../computed'
import { Effect } from '../effect'
import { Signal } from '../signal'

describe('Effect + Computed', () => {
	it('reruns effect when dependency signal changes', () => {
		const count = new Signal(0)
		const seen: number[] = []
		const fx = new Effect(() => {
			seen.push(count.value)
		})
		count.value = 1
		count.value = 2
		fx.destroy()
		count.value = 3
		expect(seen).toEqual([0, 1, 2])
	})

	it('updates computed value when dependencies change', () => {
		const a = new Signal(1)
		const b = new Signal(2)
		const sum = new Computed(() => a.value + b.value)
		expect(sum.value).toBe(3)
		a.value = 5
		expect(sum.value).toBe(7)
		sum.destroy()
	})
})
