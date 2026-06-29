/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { performSwap as hypermediaPerformSwap } from '@aero-js/hypermedia'
import { installHypermediaSwapLifecycle, mountClientBindings } from '../client-mount'
import { shouldRemountCompiledSwap } from '../swap-remount'
import { HYPERMEDIA_RUNTIME_GLOBAL_KEY } from '../hypermedia-bootstrap'

afterEach(() => {
	vi.unstubAllEnvs()
	delete (globalThis as unknown as Record<string, unknown>)[HYPERMEDIA_RUNTIME_GLOBAL_KEY]
})

type TestSwapLifecycleOperation = {
	target: Element
	html: string
	style: string
	targetSelector: string
	performSwap(): void
	processRuntime(element: ParentNode): void
}

type TestSwapLifecycleAdapter = (operation: TestSwapLifecycleOperation) => void | Promise<void>

type TestHypermediaRuntime = {
	readonly kind: 'hypermedia-runtime'
	executeAction: () => void
	swapElement(targetSelector: string, html: string, style: string): Promise<void>
	process: (element: ParentNode) => void
	registerBusyBinding: () => void
	setSwapLifecycleAdapter(adapter: TestSwapLifecycleAdapter | null): void
}

function createRuntimeHarness(): TestHypermediaRuntime {
	let adapter: TestSwapLifecycleAdapter | null = null
	const runtime: TestHypermediaRuntime = {
		kind: 'hypermedia-runtime',
		executeAction: vi.fn(),
		swapElement: async (targetSelector: string, html: string, style: string): Promise<void> => {
			const target = document.querySelector(targetSelector)
			if (!target) throw new Error(`missing target ${targetSelector}`)
			const operation = {
				target,
				html,
				style,
				targetSelector,
				performSwap() {
					hypermediaPerformSwap({ target, html, style: style as never })
				},
				processRuntime(element: ParentNode) {
					runtime.process(element)
				},
			}
			if (adapter) {
				await adapter(operation)
				return
			}
			operation.performSwap()
			operation.processRuntime(target)
		},
		process: vi.fn((element: ParentNode) => {
			for (const el of element.querySelectorAll<Element>('[data-aero-on-click]')) {
				el.setAttribute('data-aero-processed', '')
			}
		}),
		registerBusyBinding: vi.fn(),
		setSwapLifecycleAdapter(nextAdapter) {
			adapter = nextAdapter
		},
	}
	return runtime
}

describe('installHypermediaSwapLifecycle', () => {
	it('does not process-scan the compiled root during initial client mount', () => {
		vi.stubEnv('AERO_HYPERMEDIA', true as unknown as string)
		const root = document.createElement('main')
		const hypermediaProcess = vi.fn()
		const runtime = {
			kind: 'hypermedia-runtime' as const,
			executeAction: vi.fn(),
			swapElement: vi.fn(),
			process: hypermediaProcess,
			registerBusyBinding: vi.fn(),
			setSwapLifecycleAdapter: vi.fn(),
		}
		;(globalThis as unknown as Record<string, unknown>)[HYPERMEDIA_RUNTIME_GLOBAL_KEY] = runtime
		const aero = {
			mountStateBindingsForPath: vi.fn(() => () => {}),
			hasStateBindingsForPath: vi.fn(() => true),
		}

		const cleanup = mountClientBindings(aero as never, '/', root)

		expect(hypermediaProcess).not.toHaveBeenCalled()
		expect(runtime.setSwapLifecycleAdapter).toHaveBeenCalledWith(expect.any(Function))
		cleanup()
	})

	it('uses destroy -> swap -> remount for compiled-root swaps', async () => {
		document.body.innerHTML = '<main id="app"><button id="trigger">save</button><p>old</p></main>'
		const root = document.querySelector('#app') as HTMLElement
		const calls: string[] = []
		const runtime = createRuntimeHarness()

		installHypermediaSwapLifecycle({
			root,
			runtime,
			shouldRemountCompiled: () => true,
			destroyPrevious: () => calls.push('destroy'),
			remountCompiled: () => {
				calls.push('remount')
			},
		})

		await runtime.swapElement('#app', '<p>new</p>', 'innerHTML')

		expect(calls).toEqual(['destroy', 'remount'])
		expect(root.innerHTML).toBe('<p>new</p>')
	})

	it('processes runtime hypermedia after remount on outerHTML swaps', async () => {
		document.body.innerHTML = '<main id="app"><div id="nested-host">old</div></main>'
		const root = document.querySelector('#app') as HTMLElement
		const runtime = createRuntimeHarness()
		const processSpy = vi.spyOn(runtime, 'process')

		installHypermediaSwapLifecycle({
			root,
			runtime,
			shouldRemountCompiled: () => true,
			destroyPrevious: vi.fn(),
			remountCompiled: vi.fn(),
		})

		await runtime.swapElement(
			'#nested-host',
			'<div id="nested-host"><button data-aero-on-click="{ GET(\'/next\') }">next</button></div>',
			'outerHTML'
		)

		const nextHost = document.querySelector('#nested-host')
		expect(processSpy).toHaveBeenCalledWith(nextHost)
		expect(nextHost?.querySelector('button')?.hasAttribute('data-aero-processed')).toBe(true)
	})

	it('keeps runtime-authored fragments on the process path', async () => {
		document.body.innerHTML = '<main id="app"><section id="runtime">old</section></main>'
		const root = document.querySelector('#app') as HTMLElement
		const runtime = createRuntimeHarness()
		const processSpy = vi.spyOn(runtime, 'process')
		const remountCompiled = vi.fn()

		installHypermediaSwapLifecycle({
			root,
			runtime,
			shouldRemountCompiled: operation => shouldRemountCompiledSwap(root, operation, true),
			destroyPrevious: vi.fn(),
			remountCompiled,
		})

		await runtime.swapElement(
			'#runtime',
			'<button data-aero-on-click="{ GET(\'/next\') }">next</button>',
			'innerHTML'
		)

		expect(remountCompiled).not.toHaveBeenCalled()
		expect(processSpy).toHaveBeenCalledWith(document.querySelector('#runtime'))
		expect(document.querySelector('#runtime')?.innerHTML).toContain('data-aero-processed')
	})

	it('uses per-target remount policy from mountClientBindings', async () => {
		vi.stubEnv('AERO_HYPERMEDIA', true as unknown as string)
		document.body.innerHTML =
			'<main id="app"><section id="runtime-host">old</section><section id="compiled"><span data-aero-text="0">x</span></section></main>'
		const root = document.querySelector('#app') as HTMLElement
		const runtime = createRuntimeHarness()
		;(globalThis as unknown as Record<string, unknown>)[HYPERMEDIA_RUNTIME_GLOBAL_KEY] = runtime
		const aero = {
			mountStateBindingsForPath: vi.fn(() => () => {}),
			hasStateBindingsForPath: vi.fn(() => true),
		}

		const cleanup = mountClientBindings(aero as never, '/', root)
		expect(aero.mountStateBindingsForPath).toHaveBeenCalledTimes(1)

		await runtime.swapElement(
			'#runtime-host',
			'<button data-aero-on-click="{ GET(\'/next\') }">next</button>',
			'innerHTML'
		)
		expect(aero.mountStateBindingsForPath).toHaveBeenCalledTimes(1)

		await runtime.swapElement('#compiled', '<span data-aero-text="0">y</span>', 'innerHTML')
		expect(aero.mountStateBindingsForPath).toHaveBeenCalledTimes(2)

		cleanup()
	})

	it('removes the adapter during cleanup', async () => {
		document.body.innerHTML = '<main id="app"><section id="runtime">old</section></main>'
		const root = document.querySelector('#app') as HTMLElement
		const runtime = createRuntimeHarness()
		const remountCompiled = vi.fn()
		const cleanup = installHypermediaSwapLifecycle({
			root,
			runtime,
			shouldRemountCompiled: () => true,
			destroyPrevious: vi.fn(),
			remountCompiled,
		})

		cleanup()
		await runtime.swapElement('#runtime', '<p>new</p>', 'innerHTML')

		expect(remountCompiled).not.toHaveBeenCalled()
		expect(document.querySelector('#runtime')?.innerHTML).toBe('<p>new</p>')
	})
})
