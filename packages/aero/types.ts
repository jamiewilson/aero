export interface AeroDirs {
	/** Site source directory; pages live at `<src>/pages` (default: 'src') */
	src?: string
	/** Data directory watched for HMR (default: 'data') */
	data?: string
	/** Nitro server directory (default: 'server') */
	server?: string
	/** Build output directory (default: 'dist') */
	dist?: string
}

export interface AeroOptions {
	/** Enable Nitro server integration (default: false) */
	nitro?: boolean
	/** API route prefix (default: '/api') */
	apiPrefix?: string
	/** Directory overrides */
	dirs?: AeroDirs
}

export interface MountOptions {
	target?: string | HTMLElement
	onRender?: (root: HTMLElement) => void
}

export interface CompileOptions {
	root: string
	clientScriptUrl?: string
	resolvePath?: (specifier: string) => string
}

export interface ResolverOptions {
	root: string
	resolvePath?: (specifier: string) => string
}

export interface ParseResult {
	buildScript: { content: string } | null
	clientScript: { content: string } | null
	template: string
}

export interface UserAlias {
	find: string
	replacement: string
}

export interface AliasResult {
	aliases: UserAlias[]
	resolvePath?: (specifier: string) => string
}

export interface PageFragments {
	head: string
	body: string
}
