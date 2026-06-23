import {
	bootstrapHypermediaRuntime,
	readBootstrappedHypermediaRuntime,
} from './hypermedia-bootstrap'
import { bootstrapReactivityRuntime, readBootstrappedReactivityRuntime } from './reactivity-bootstrap'
import type { Aero } from './index'

export { readBootstrappedReactivityRuntime }

interface HypermediaSwapLifecycleOperation {
	target: Element
	html: string
	style: string
	trigger?: Element
	targetSelector: string
	performSwap(): void
	adoptRuntime(container: ParentNode): void
}

type HypermediaSwapLifecycleAdapter = (
	operation: HypermediaSwapLifecycleOperation
) => void | Promise<void>

export interface HypermediaRuntimeWithSwapLifecycle {
	setSwapLifecycleAdapter(adapter: HypermediaSwapLifecycleAdapter | null): void
}

/** True when the Vite/Aero plugin enabled hypermedia for this app build. */
export function isHypermediaEnabled(): boolean {
	return import.meta.env.AERO_HYPERMEDIA === true
}

export function bootstrapClientRuntimes(): void {
	bootstrapReactivityRuntime()
	if (isHypermediaEnabled()) {
		bootstrapHypermediaRuntime()
	}
}

export function createHypermediaRuntimeAccessor(): () => ReturnType<typeof readBootstrappedHypermediaRuntime> {
	return () => readBootstrappedHypermediaRuntime()
}

export interface HypermediaSwapLifecycleBinding {
	readonly root: HTMLElement
	readonly runtime: HypermediaRuntimeWithSwapLifecycle
	readonly shouldRemountCompiled: (operation: HypermediaSwapLifecycleOperation) => boolean | Promise<boolean>
	readonly destroyPrevious: () => void
	readonly remountCompiled: () => void | Promise<void>
}

function isWithinRoot(root: HTMLElement, target: Element): boolean {
	return target === root || root.contains(target)
}

export function installHypermediaSwapLifecycle(binding: HypermediaSwapLifecycleBinding): () => void {
	const { root, runtime } = binding
	let active = true

	runtime.setSwapLifecycleAdapter(async operation => {
		if (!active) {
			operation.performSwap()
			operation.adoptRuntime(operation.target)
			return
		}

		if (isWithinRoot(root, operation.target) && await binding.shouldRemountCompiled(operation)) {
			binding.destroyPrevious()
			operation.performSwap()
			await binding.remountCompiled()
			return
		}

		operation.performSwap()
		operation.adoptRuntime(operation.target)
	})

	return () => {
		active = false
		runtime.setSwapLifecycleAdapter(null)
	}
}

export function mountClientBindings(aero: Aero, pathname: string, root: HTMLElement): () => void {
	bootstrapClientRuntimes()
	let destroyStateBindings = aero.mountStateBindingsForPath(pathname, root)
	const runtime = readBootstrappedHypermediaRuntime() as HypermediaRuntimeWithSwapLifecycle | null
	const cleanupSwapLifecycle = runtime
		? installHypermediaSwapLifecycle({
				root,
				runtime,
				shouldRemountCompiled: () => aero.hasStateBindingsForPath(pathname),
				destroyPrevious() {
					destroyStateBindings()
					destroyStateBindings = () => {}
				},
				remountCompiled() {
					destroyStateBindings = aero.mountStateBindingsForPath(pathname, root)
				},
			})
		: () => {}

	return () => {
		cleanupSwapLifecycle()
		destroyStateBindings()
	}
}
