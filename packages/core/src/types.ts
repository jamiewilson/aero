/**
 * Shared type definitions for the Aero framework (compiler, runtime, Vite plugin).
 *
 * @remarks
 * Grouped roughly by: config/dirs, compile/parse, resolver/aliases, routing, render context.
 */

export interface AeroDirs {
	/** Site source directory; pages live at `client/pages` (default: `'client'`). */
	client?: string
	/** Nitro server directory (default: `'server'`). */
	server?: string
	/** Build output directory (default: `'dist'`). */
	dist?: string
}

/** One redirect rule: from path to URL, optional status (default 302). */
export interface RedirectRule {
	from: string
	to: string
	status?: number
}

export interface AeroOptions {
	/** Enable Nitro server integration (default: `false`). */
	nitro?: boolean
	/** API route prefix (default: `'/api'`). */
	apiPrefix?: string
	/** Directory overrides. */
	dirs?: AeroDirs
	/**
	 * Canonical site URL (e.g. `'https://example.com'`). Exposed as `import.meta.env.SITE` and
	 * as `Aero.site` in templates. Used for sitemap, RSS, and canonical links.
	 */
	site?: string
	/**
	 * Redirect rules applied in dev (Vite) and when using the Nitro server (preview:api / production).
	 * For static-only deploys use host redirect config (_redirects, vercel.json, etc.).
	 */
	redirects?: RedirectRule[]
	/**
	 * Optional request-time middleware (redirects, rewrites, custom responses).
	 * Runs in dev before rendering; for production redirects use Nitro server middleware or `redirects` config.
	 */
	middleware?: AeroMiddleware[]
	/**
	 * Optional plugins to add to the static render server (e.g. content plugin when using aero:content).
	 * Merged after the core Aero plugins so pages that import aero:content resolve during static build.
	 */
	staticServerPlugins?: import('vite').Plugin[]
}

/** Request context passed to middleware (url, request, route path, resolved page name, site). */
export interface AeroRequestContext {
	url: URL
	request: Request
	routePath: string
	pageName: string
	site?: string
}

/** Result of middleware: redirect, rewrite render input, or send a custom response. */
export type AeroMiddlewareResult =
	| { redirect: { url: string; status?: number } }
	| { rewrite: Partial<AeroRenderInput> & { pageName?: string } }
	| { response: Response }
	| void

/** Middleware handler: receives request context; returns redirect/rewrite/response or nothing to continue. */
export type AeroMiddleware = (
	ctx: AeroRequestContext,
) => AeroMiddlewareResult | Promise<AeroMiddlewareResult>

/** Options for the client-side `mount()` entry (see `core/src/entry-dev.ts`). */
export interface MountOptions {
	/** Root element: CSS selector or `HTMLElement`. Defaults to `#app`. */
	target?: string | HTMLElement
	/** Called with the root element after mount and after each HMR re-render. */
	onRender?: (root: HTMLElement) => void
}

/**
 * Single script entry: attrs (optional), content (body or virtual URL), optional pass:data expression.
 * Used by parser, codegen, Vite plugin, and static build for client/inline/blocking script arrays.
 */
export interface ScriptEntry {
	attrs?: string
	content: string
	passDataExpr?: string
	/** If true, client script is injected in <head> instead of before </body>. */
	injectInHead?: boolean
}

/**
 * Input to the codegen compiler for a single template.
 *
 * @remarks
 * Script arrays come from the parser; `root` and `resolvePath` from the build.
 */
export interface CompileOptions {
	root: string
	/** Client script entries (plain `<script>`): after transform, `content` may be virtual URL. */
	clientScripts?: ScriptEntry[]
	/** Inline scripts (`is:inline`) to be emitted in the page. */
	inlineScripts?: ScriptEntry[]
	/** Blocking scripts (`is:blocking`) to be emitted in the page. */
	blockingScripts?: ScriptEntry[]
	/** Resolve import specifiers (e.g. `@components/foo`) to absolute paths. */
	resolvePath?: (specifier: string) => string
}

/** Options for the path resolver (e.g. resolving `@components/foo` to a file path). */
export interface ResolverOptions {
	root: string
	resolvePath?: (specifier: string) => string
}

/**
 * Result of parsing one HTML template.
 *
 * @remarks
 * Produced by `parser.ts`. Extracted script blocks and the remaining template string for codegen.
 */
export interface ParseResult {
	/** Single `<script is:build>` block, or `null` if none. */
	buildScript: { content: string } | null
	clientScripts: ScriptEntry[]
	inlineScripts: ScriptEntry[]
	blockingScripts: ScriptEntry[]
	/** HTML after script blocks are stripped; used as input to codegen. */
	template: string
}

/** One path alias from tsconfig (e.g. find: `@components`, replacement: `.../src/components`). */
export interface UserAlias {
	find: string
	replacement: string
}

/** Result of loading project path aliases (`utils/aliases.ts`). */
export interface AliasResult {
	aliases: UserAlias[]
	resolvePath?: (specifier: string) => string
}

/** Head and body HTML fragments (e.g. from `runtime/client` `extractDocumentParts`). */
export interface PageFragments {
	head: string
	body: string
}

/** Dynamic route segment key → value (e.g. `{ id: '42' }` for `/posts/42`). */
export interface AeroRouteParams {
	[key: string]: string
}

/** One static path for pre-rendering (e.g. from static path discovery). */
export interface StaticPathEntry {
	params: AeroRouteParams
	props?: Record<string, any>
}

/**
 * Input passed into a page or layout render (request, url, params, etc.).
 *
 * @remarks
 * Used by the runtime when calling the compiled render function and when rendering child components.
 */
export interface AeroRenderInput {
	props?: Record<string, any>
	/** Named slot content (key → HTML string) for layout/page render. */
	slots?: Record<string, string>
	request?: Request
	url?: URL | string
	params?: AeroRouteParams
	/** Resolved route path pattern (e.g. `'/posts/[id]'`) for the current request. */
	routePath?: string
	/** Accumulated style URLs/labels for this request. */
	styles?: Set<string>
	/** Accumulated script URLs/labels for this request. */
	scripts?: Set<string>
	/** Scripts to inject in <head>. */
	headScripts?: Set<string>
	/** Canonical site URL from config (e.g. `'https://example.com'`). Exposed as Aero.site in templates. */
	site?: string
}

/**
 * Context object available inside compiled templates (`is:build`) and when rendering components.
 *
 * @remarks
 * Includes `props`, `slots`, `renderComponent`, `request`, `url`, `params`, and optional style/script sets.
 * The index signature allows extra keys (e.g. from content or page data).
 */
export interface AeroTemplateContext {
	[key: string]: any
	props: Record<string, any>
	slots: Record<string, string>
	/** Used by codegen to emit calls that render a child component and return its HTML. */
	renderComponent: (
		component: any,
		props?: Record<string, any>,
		slots?: Record<string, string>,
		context?: AeroRenderInput,
	) => Promise<string>
	request: Request
	url: URL
	params: AeroRouteParams
	/** Canonical site URL from config (e.g. `'https://example.com'`). */
	site?: string
	styles?: Set<string>
	scripts?: Set<string>
	headScripts?: Set<string>
}
