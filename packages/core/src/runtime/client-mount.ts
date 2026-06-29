import {
	bootstrapHypermediaRuntime,
	readBootstrappedHypermediaRuntime,
} from './hypermedia-bootstrap'
import { bootstrapReactivityRuntime, readBootstrappedReactivityRuntime } from './reactivity-bootstrap'
import { resolveSwapProcessContainer, type SwapStyle } from '@aero-js/hypermedia'
import type { Aero } from './index'
import { shouldRemountCompiledSwap } from './swap-remount'

export { readBootstrappedReactivityRuntime }

interface HypermediaSwapLifecycleOperation {
	target: Element
	html: string
	style: string
	trigger?: Element
	targetSelector: string
	performSwap(): void
	processRuntime(element: ParentNode): void
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

let hypermediaReactivityProcessComposed = false

/** Compose hypermedia and reactivity process() for runtime-inserted HTML. */
export function composeHypermediaReactivityProcess(): void {
	if (hypermediaReactivityProcessComposed) return
	const hypermedia = readBootstrappedHypermediaRuntime() as (HypermediaRuntimeWithSwapLifecycle & {
		process?: (element: ParentNode, store?: unknown) => void
	}) | null
	const reactivity = readBootstrappedReactivityRuntime() as {
		process?: (element: ParentNode, store?: unknown) => () => void
		store: unknown
	} | null
	if (!hypermedia?.process || !reactivity?.process) return
	const hypermediaProcess = hypermedia.process.bind(hypermedia)
	const reactivityProcess = reactivity.process
	hypermedia.process = (element: ParentNode, store?: unknown) => {
		hypermediaProcess(element, store)
		reactivityProcess(element, reactivity.store)
	}
	hypermediaReactivityProcessComposed = true
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

function processAfterSwap(operation: HypermediaSwapLifecycleOperation): void {
	const element = resolveSwapProcessContainer(
		operation.target,
		operation.style as SwapStyle,
		operation.targetSelector,
		operation.target.ownerDocument ?? document
	)
	operation.processRuntime(element)
}

export function installHypermediaSwapLifecycle(binding: HypermediaSwapLifecycleBinding): () => void {
	const { root, runtime } = binding
	let active = true

	runtime.setSwapLifecycleAdapter(async operation => {
		if (!active) {
			operation.performSwap()
			processAfterSwap(operation)
			return
		}

		if (
			isWithinRoot(root, operation.target) &&
			(await binding.shouldRemountCompiled(operation))
		) {
			binding.destroyPrevious()
			operation.performSwap()
			await binding.remountCompiled()
			processAfterSwap(operation)
			return
		}

		operation.performSwap()
		processAfterSwap(operation)
	})

	return () => {
		active = false
		runtime.setSwapLifecycleAdapter(null)
	}
}

export function mountClientBindings(aero: Aero, pathname: string, root: HTMLElement): () => void {
	bootstrapClientRuntimes()
	composeHypermediaReactivityProcess()
	let destroyStateBindings = aero.mountStateBindingsForPath(pathname, root)
	const runtime = readBootstrappedHypermediaRuntime() as HypermediaRuntimeWithSwapLifecycle | null
	const cleanupSwapLifecycle = runtime
		? installHypermediaSwapLifecycle({
				root,
				runtime,
				shouldRemountCompiled: operation =>
					shouldRemountCompiledSwap(
						root,
						operation,
						aero.hasStateBindingsForPath(pathname)
					),
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
