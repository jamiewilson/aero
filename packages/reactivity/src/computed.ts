import { Effect } from './effect'
import { Signal } from './signal'

export class Computed<T> {
	private readonly signal: Signal<T>
	private readonly effect: Effect

	constructor(fn: () => T) {
		this.signal = new Signal<T>(undefined as T)
		this.effect = new Effect(() => {
			this.signal.value = fn()
		})
	}

	get value(): T {
		return this.signal.value
	}

	peek(): T {
		return this.signal.peek()
	}

	subscribe(cb: (value: T) => void): () => void {
		return this.signal.subscribe(cb)
	}

	toJSON(): T {
		return this.signal.toJSON()
	}

	destroy(): void {
		this.effect.destroy()
	}
}
