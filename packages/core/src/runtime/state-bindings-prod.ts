import { resolvePageName } from '../utils/routing'
import type { Aero } from './index'

export type StateBindingsMountFn = (
	root: HTMLElement,
	runtime: Aero
) => void | (() => void)

export type ResolveStateBindingsModule = (
	pathname: string
) => Promise<StateBindingsMountFn | null>

export interface MountStateBindingsResult {
	cleanup: () => void
	hasStateBindings: boolean
}

/**
 * Load the current route's compiled `mountStateBindings` and invoke it against the mount root.
 */
export async function mountStateBindingsForRoute(
	aero: Aero,
	pathname: string,
	root: HTMLElement,
	resolveModule: ResolveStateBindingsModule
): Promise<MountStateBindingsResult> {
	const mountFn = await resolveModule(pathname)
	if (!mountFn) return { cleanup: () => {}, hasStateBindings: false }
	const cleanup = mountFn(root, aero)
	return {
		cleanup: typeof cleanup === 'function' ? cleanup : () => {},
		hasStateBindings: true,
	}
}

/** @internal Test helper mirroring registry page-name lookup order. */
export function resolveStatePageLoaderKey(pathname: string): string {
	return resolvePageName(pathname)
}
