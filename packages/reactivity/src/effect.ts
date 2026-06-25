export type EffectCleanup = void | (() => void)

export class Effect {
	static active: Effect | null = null

	private fn: () => EffectCleanup
	private cleanup: (() => void) | null = null
	private deps = new Set<{ delete: (eff: Effect) => void }>()
	private destroyed = false

	constructor(fn: () => EffectCleanup) {
		this.fn = fn
		this.run()
	}

	track(dep: { add: (eff: Effect) => void; delete: (eff: Effect) => void }): void {
		dep.add(this)
		this.deps.add(dep)
	}

	schedule(): void {
		if (this.destroyed) return
		this.run()
	}

	destroy(): void {
		if (this.destroyed) return
		this.destroyed = true
		this.cleanup?.()
		this.cleanup = null
		for (const dep of this.deps) dep.delete(this)
		this.deps.clear()
	}

	private run(): void {
		this.cleanup?.()
		this.cleanup = null
		for (const dep of this.deps) dep.delete(this)
		this.deps.clear()

		const previous = Effect.active
		Effect.active = this
		try {
			const cleanup = this.fn()
			this.cleanup = typeof cleanup === 'function' ? cleanup : null
		} finally {
			Effect.active = previous
		}
	}
}
