export interface TbdDirs {
	/** Template root directory (default: 'client') */
	templates?: string
	/** Pages directory (default: 'client/pages') */
	pages?: string
	/** Data directory watched for HMR (default: 'data') */
	data?: string
	/** Nitro server directory (default: './server') */
	server?: string
}

export interface TbdOptions {
	/** Enable Nitro server integration (default: reads WITH_NITRO env var) */
	nitro?: boolean
	/** API route prefix (default: '/api') */
	apiPrefix?: string
	/** Directory overrides */
	dirs?: TbdDirs
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
