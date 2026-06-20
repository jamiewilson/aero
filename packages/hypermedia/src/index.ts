export interface HypermediaRuntime {
	readonly kind: 'hypermedia-runtime'
}

export interface HypermediaRuntimeOptions {
	readonly debug?: boolean
}

/**
 * Phase 1.5 placeholder entrypoint.
 * Runtime behavior lands in Phase 3.
 */
export function createHypermediaRuntime(_options: HypermediaRuntimeOptions = {}): HypermediaRuntime {
	return { kind: 'hypermedia-runtime' }
}
