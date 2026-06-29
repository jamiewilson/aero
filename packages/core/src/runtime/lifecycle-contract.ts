export type DestroyFn = () => void

export type ReplacementSourceKind = 'compiled' | 'runtime'

export interface ReplacementLifecycleHooks {
	destroyPrevious: DestroyFn
	swap: () => void
	remountCompiled: () => DestroyFn
	processRuntime: () => DestroyFn
}

/**
 * Phase 1 substrate contract:
 * - compiled replacement: destroy -> swap -> remount
 * - runtime fragment replacement: destroy -> swap -> process
 */
export function replaceRegionWithLifecycle(
	sourceKind: ReplacementSourceKind,
	hooks: ReplacementLifecycleHooks
): DestroyFn {
	hooks.destroyPrevious()
	hooks.swap()
	if (sourceKind === 'compiled') {
		return hooks.remountCompiled()
	}
	return hooks.processRuntime()
}

/**
 * Guardrail: compiled roots must not be wired via process scanner.
 */
export function assertProcessAllowed(target: { isCompiledRoot?: boolean }): void {
	if (target.isCompiledRoot === true) {
		throw new Error(
			'[aero] Invalid process() call on compiled root. Use destroy + remount lifecycle instead.'
		)
	}
}
