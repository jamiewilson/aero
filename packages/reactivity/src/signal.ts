import { Effect } from './effect'
import { toRaw } from './reactive'

export class Signal<T> {
	private _value: T
	private effects = new Set<Effect>()
	private subscribers = new Set<(value: T) => void>()

	constructor(initialValue: T) {
		this._value = initialValue
	}

	get value(): T {
		if (Effect.active) {
			Effect.active.track(this.effects)
		}
		return this._value
	}

	set value(val: T) {
		if (Object.is(this._value, val)) return
		this._value = val
		this.notify()
	}

	notify(): void {
		for (const eff of Array.from(this.effects)) {
			eff.schedule()
		}
		for (const sub of Array.from(this.subscribers)) {
			sub(this._value)
		}
	}

	peek(): T {
		return this._value
	}

	subscribe(cb: (value: T) => void): () => void {
		this.subscribers.add(cb)
		return () => {
			this.subscribers.delete(cb)
		}
	}

	toJSON(): T {
		return toRaw(this._value)
	}
}
