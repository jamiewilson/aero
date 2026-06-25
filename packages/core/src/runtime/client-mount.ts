import {
	bootstrapHypermediaRuntime,
	readBootstrappedHypermediaRuntime,
} from './hypermedia-bootstrap'
import { bootstrapReactivityRuntime, readBootstrappedReactivityRuntime } from './reactivity-bootstrap'
import type { Aero } from './index'

export { readBootstrappedReactivityRuntime }

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

export function wireHypermediaAdopt(root: ParentNode): void {
	if (!isHypermediaEnabled()) return
	const runtime = readBootstrappedHypermediaRuntime() ?? bootstrapHypermediaRuntime()
	runtime.adopt(root)
}

export function createHypermediaRuntimeAccessor(): () => ReturnType<typeof readBootstrappedHypermediaRuntime> {
	return () => readBootstrappedHypermediaRuntime()
}

export function mountClientBindings(aero: Aero, pathname: string, root: HTMLElement): () => void {
	bootstrapClientRuntimes()
	wireHypermediaAdopt(root)
	return aero.mountStateBindingsForPath(pathname, root)
}
