export interface AeroDirs {
	/** Site source directory; pages live at `<client>/pages` (default: 'client') */
	client?: string
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

export interface AeroRouteParams {
	[key: string]: string
}

export interface StaticPathEntry {
	params: AeroRouteParams
	props?: Record<string, any>
}

export interface AeroRenderInput {
	props?: Record<string, any>
	request?: Request
	url?: URL | string
	params?: AeroRouteParams
	routePath?: string
	styles?: Set<string>
}

export interface AeroTemplateContext {
	[key: string]: any
	props: Record<string, any>
	slots: Record<string, string>
	renderComponent: (
		component: any,
		props?: Record<string, any>,
		slots?: Record<string, string>,
		context?: AeroRenderInput,
	) => Promise<string>
	request: Request
	url: URL
	params: AeroRouteParams
	styles?: Set<string>
}
