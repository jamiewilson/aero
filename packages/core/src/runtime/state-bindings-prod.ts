import { resolvePageName } from '../utils/routing'
import type { Aero } from './index'

export type StateBindingsMountFn = (
	root: HTMLElement,
	runtime: Aero
) => void | (() => void)

export type ResolveStateBindingsModule = (
	pathname: string
) => Promise<StateBindingsMountFn | null>

/**
 * Load the current route's compiled `mountStateBindings` and invoke it against the mount root.
 */
export async function mountStateBindingsForRoute(
	aero: Aero,
	pathname: string,
	root: HTMLElement,
	resolveModule: ResolveStateBindingsModule
): Promise<() => void> {
	const mountFn = await resolveModule(pathname)
	if (!mountFn) return () => {}
	const cleanup = mountFn(root, aero)
	return typeof cleanup === 'function' ? cleanup : () => {}
}

/** @internal Test helper mirroring registry page-name lookup order. */
export function resolveStatePageLoaderKey(pathname: string): string {
	return resolvePageName(pathname)
}
