import { describe, expect, it, vi } from 'vitest'
import { Effect } from '../effect'
import { mountStateBindings } from '../mount'
import { createStateScope } from '../state-scope'
import { SignalStore } from '../store'

describe('$effect mount integration', () => {
	it('runs effectRuns on mount with initial signal values', () => {
		const store = new SignalStore()
		store.signal('count', 0)
		const scope = createStateScope({
			store,
			bindings: [{ name: 'count', derived: false, initExpr: '0', dependencies: [] }],
			functionSources: [],
		})
		const runs: number[] = []

		const cleanup = mountStateBindings({
			root: document.createElement('div'),
			store,
			scope,
			bindings: [],
			textBinds: [],
			eventBinds: [],
			effectRuns: [
				s => {
					const effect = new Effect(() => {
						runs.push(s.count as number)
					})
					return () => effect.destroy()
				},
			],
		})

		expect(runs).toEqual([0])
		cleanup()
	})

	it('re-runs effectRuns when tracked signals change', () => {
		const store = new SignalStore()
		store.signal('count', 0)
		const scope = createStateScope({
			store,
			bindings: [{ name: 'count', derived: false, initExpr: '0', dependencies: [] }],
			functionSources: [],
		})
		const runs: number[] = []

		const cleanup = mountStateBindings({
			root: document.createElement('div'),
			store,
			scope,
			bindings: [],
			textBinds: [],
			eventBinds: [],
			effectRuns: [
				s => {
					const effect = new Effect(() => {
						runs.push(s.count as number)
					})
					return () => effect.destroy()
				},
			],
		})

		;(store.get('count') as { value: number }).value = 2
		expect(runs).toEqual([0, 2])
		cleanup()
	})

	it('calls effect cleanup on re-run and destroy', () => {
		const store = new SignalStore()
		store.signal('count', 0)
		const scope = createStateScope({
			store,
			bindings: [{ name: 'count', derived: false, initExpr: '0', dependencies: [] }],
			functionSources: [],
		})
		const cleanups: number[] = []

		const cleanup = mountStateBindings({
			root: document.createElement('div'),
			store,
			scope,
			bindings: [],
			textBinds: [],
			eventBinds: [],
			effectRuns: [
				s => {
					const effect = new Effect(() => {
						s.count
						return () => {
							cleanups.push(1)
						}
					})
					return () => effect.destroy()
				},
			],
		})

		;(store.get('count') as { value: number }).value = 1
		expect(cleanups).toEqual([1])
		cleanup()
	})

	it('exposes $root on scope when mountRoot is provided', () => {
		const root = document.createElement('div')
		const store = new SignalStore()
		const scope = createStateScope({
			store,
			bindings: [],
			mountRoot: root,
		})
		expect(scope.$root).not.toBe(root)
		expect((scope.$root as ParentNode).querySelector('div')).toBe(root)
	})
})
