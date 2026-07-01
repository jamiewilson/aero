/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { mountStateBindings, processFragment } from '@aero-js/reactivity'
import { SignalStore } from '@aero-js/reactivity'

const baseline = JSON.parse(
	readFileSync(
		resolve(dirname(fileURLToPath(import.meta.url)), 'perf-baseline.json'),
		'utf8'
	)
) as {
	processFragment100CyclesMs: number
	mountDestroy100CyclesMs: number
}

describe('runtime perf stress', () => {
	it('processFragment 100-cycle stress stays within baseline', () => {
		const store = new SignalStore()
		store.merge({ note: 'hello', showNote: true })
		const host = document.createElement('div')
		host.innerHTML = '<p data-aero-show="$showNote"><span data-aero-text="$note"></span></p>'

		const start = performance.now()
		for (let i = 0; i < 100; i++) {
			const cleanup = processFragment({ element: host, store })
			cleanup()
		}
		const elapsed = performance.now() - start

		expect(elapsed).toBeLessThan(baseline.processFragment100CyclesMs)
	})

	it('mount and destroy 100 cycles stays within baseline', () => {
		const store = new SignalStore()
		const root = document.createElement('div')
		root.innerHTML = '<span data-aero-text="0"></span>'

		const start = performance.now()
		for (let i = 0; i < 100; i++) {
			const cleanup = mountStateBindings({
				root,
				store,
				bindings: [{ name: 'count', derived: false, init: () => 1, dependencies: [] }],
				textBinds: [
					{
						selector: '[data-aero-text="0"]',
						read: (scope, escapeHtml) => escapeHtml?.(String(scope.count)),
					},
				],
				eventBinds: [],
				escapeHtml: v => String(v),
			})
			cleanup()
		}
		const elapsed = performance.now() - start

		expect(elapsed).toBeLessThan(baseline.mountDestroy100CyclesMs)
	})

	it('cleans up listeners after repeated process cycles', () => {
		const store = new SignalStore()
		store.merge({ note: 'hello', showNote: true })
		const host = document.createElement('div')
		host.innerHTML = '<p data-aero-show="$showNote"><span data-aero-text="$note"></span></p>'

		for (let i = 0; i < 100; i++) {
			const cleanup = processFragment({ element: host, store })
			cleanup()
			for (const el of host.querySelectorAll('[data-aero-processed]')) {
				el.removeAttribute('data-aero-processed')
			}
		}

		const cleanup = processFragment({ element: host, store })
		store.get<string>('note').value = 'updated'
		expect(host.textContent).toBe('updated')
		cleanup()
	})
})
