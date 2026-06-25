/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installHypermediaSwapLifecycle, mountClientBindings } from '../client-mount'
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
	adoptRuntime(container: ParentNode): void
}

type TestSwapLifecycleAdapter = (operation: TestSwapLifecycleOperation) => void | Promise<void>

type TestHypermediaRuntime = {
	readonly kind: 'hypermedia-runtime'
	executeAction: () => void
	swapElement(targetSelector: string, html: string, style: string): void
	adopt: (container: ParentNode) => void
	registerBusyBinding: () => void
	setSwapLifecycleAdapter(adapter: TestSwapLifecycleAdapter | null): void
}

function createRuntimeHarness(): TestHypermediaRuntime {
	let adapter: TestSwapLifecycleAdapter | null = null
	const runtime: TestHypermediaRuntime = {
		kind: 'hypermedia-runtime',
		executeAction: vi.fn(),
		swapElement(targetSelector: string, html: string, style: string): void {
			const target = document.querySelector(targetSelector)
			if (!target) throw new Error(`missing target ${targetSelector}`)
			const operation = {
				target,
				html,
				style,
				targetSelector,
				performSwap() {
					target.innerHTML = html
				},
				adoptRuntime(container: ParentNode) {
					runtime.adopt(container)
				},
			}
			if (adapter) {
				void adapter(operation)
				return
			}
			operation.performSwap()
			operation.adoptRuntime(target)
		},
		adopt: vi.fn((container: ParentNode) => {
			for (const el of container.querySelectorAll<Element>('[data-aero-on-click]')) {
				el.setAttribute('data-aero-adopted', '')
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
	it('does not adopt-scan the compiled root during initial client mount', () => {
		vi.stubEnv('AERO_HYPERMEDIA', true as unknown as string)
		const root = document.createElement('main')
		const runtime = {
			kind: 'hypermedia-runtime' as const,
			executeAction: vi.fn(),
			swapElement: vi.fn(),
			adopt: vi.fn(),
			registerBusyBinding: vi.fn(),
			setSwapLifecycleAdapter: vi.fn(),
		}
		;(globalThis as unknown as Record<string, unknown>)[HYPERMEDIA_RUNTIME_GLOBAL_KEY] = runtime
		const aero = {
			mountStateBindingsForPath: vi.fn(() => () => {}),
			hasStateBindingsForPath: vi.fn(() => true),
		}

		const cleanup = mountClientBindings(aero as never, '/', root)

		expect(runtime.adopt).not.toHaveBeenCalled()
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

		runtime.swapElement('#app', '<p>new</p>', 'innerHTML')
		await Promise.resolve()

		expect(calls).toEqual(['destroy', 'remount'])
		expect(root.innerHTML).toBe('<p>new</p>')
	})

	it('keeps runtime-authored fragments on the adopt path', async () => {
		document.body.innerHTML = '<main id="app"><section id="runtime">old</section></main>'
		const root = document.querySelector('#app') as HTMLElement
		const runtime = createRuntimeHarness()
		const adopt = vi.spyOn(runtime, 'adopt')
		const remountCompiled = vi.fn()

		installHypermediaSwapLifecycle({
			root,
			runtime,
			shouldRemountCompiled: () => false,
			destroyPrevious: vi.fn(),
			remountCompiled,
		})

		runtime.swapElement(
			'#runtime',
			'<button data-aero-on-click="{ GET(\'/next\') }">next</button>',
			'innerHTML'
		)
		await Promise.resolve()

		expect(remountCompiled).not.toHaveBeenCalled()
		expect(adopt).toHaveBeenCalledWith(document.querySelector('#runtime'))
		expect(document.querySelector('#runtime')?.innerHTML).toContain('data-aero-adopted')
	})

	it('removes the adapter during cleanup', () => {
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
		runtime.swapElement('#runtime', '<p>new</p>', 'innerHTML')

		expect(remountCompiled).not.toHaveBeenCalled()
		expect(document.querySelector('#runtime')?.innerHTML).toBe('<p>new</p>')
	})
})
