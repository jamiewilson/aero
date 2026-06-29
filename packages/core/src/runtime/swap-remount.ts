import { hasCompiledBindSubtree, isFullPageRegionTarget } from '@aero-js/hypermedia'

interface SwapRemountOperation {
	readonly target: Element
	readonly targetSelector: string
}

export function shouldRemountCompiledSwap(
	root: HTMLElement,
	operation: SwapRemountOperation,
	hasStateBindings: boolean
): boolean {
	if (!hasStateBindings) return false
	if (operation.target !== root && !root.contains(operation.target)) return false
	if (operation.target === root) return true
	if (isFullPageRegionTarget(operation.targetSelector)) return true
	if (hasCompiledBindSubtree(operation.target)) return true
	return false
}
