export interface RenderOptions {
	el?: HTMLElement
	onRender?: (root: HTMLElement) => void
}

export interface ParseResult {
	buildScript: { content: string } | null
	clientScript: { content: string } | null
	template: string
}

export interface CompileOptions {
	// appDir removed as it was unused
	root: string
	clientScriptUrl?: string
	resolvePath?: (specifier: string) => string
}

export interface ResolverOptions {
	root: string
	resolvePath?: (specifier: string) => string
}

export interface TBDOptions {
	resolvePath?: (specifier: string) => string
}
