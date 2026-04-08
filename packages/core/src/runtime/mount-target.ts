import type { MountOptions } from '../types'

/** Resolve mount target from selector/element and throw when no element is found. */
export function resolveMountTarget(target: MountOptions['target'] = '#app'): HTMLElement {
	const el = typeof target === 'string' ? (document.querySelector(target) as HTMLElement) : target
	if (!el) throw new Error('Target element not found: ' + target)
	return el
}
