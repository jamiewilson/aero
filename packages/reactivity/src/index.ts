export interface ReactivityRuntime {
	readonly kind: 'reactivity-runtime'
}

export interface ReactivityRuntimeOptions {
	readonly debug?: boolean
}

/**
 * Phase 1.5 placeholder entrypoint.
 * Runtime behavior lands in Phase 2.
 */
export function createReactivityRuntime(_options: ReactivityRuntimeOptions = {}): ReactivityRuntime {
	return { kind: 'reactivity-runtime' }
}
