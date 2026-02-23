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

export interface AeroOptions {
	/** Enable Nitro server integration (default: `false`). */
	nitro?: boolean
	/** API route prefix (default: `'/api'`). */
	apiPrefix?: string
	/** Directory overrides. */
	dirs?: AeroDirs
}

/** Options for the client-side `mount()` entry (see `core/src/index.ts`). */
export interface MountOptions {
	/** Root element: CSS selector or `HTMLElement`. Defaults to `#app`. */
	target?: string | HTMLElement
	/** Called with the root element after mount and after each HMR re-render. */
	onRender?: (root: HTMLElement) => void
}

/**
 * Input to the codegen compiler for a single template.
 *
 * @remarks
 * Script arrays come from the parser; `root` and `resolvePath` from the build.
 */
export interface CompileOptions {
	root: string
	/** `<script on:client>` entries: attrs string, body content, optional data-pass expression (e.g. `{ { config } }`). */
	clientScripts?: { attrs: string; content: string; passDataExpr?: string }[]
	/** Inline scripts (non-client, non-build) to be emitted in the page. */
	inlineScripts?: { attrs: string; content: string; passDataExpr?: string }[]
	/** Blocking scripts to be emitted in the page. */
	blockingScripts?: { attrs: string; content: string; passDataExpr?: string }[]
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
	/** Single `<script on:build>` block, or `null` if none. */
	buildScript: { content: string } | null
	clientScripts: { attrs: string; content: string; passDataExpr?: string }[]
	inlineScripts: { attrs: string; content: string; passDataExpr?: string }[]
	blockingScripts: { attrs: string; content: string; passDataExpr?: string }[]
	/** HTML after script blocks are stripped; used as input to codegen. */
	template: string
}

// TODO: Script entry shape { attrs, content, passDataExpr? } is duplicated in CompileOptions and ParseResult; vite/build.ts has a similar ClientScriptEntry. Consider a shared type only if it simplifies the pipeline without adding indirection.

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
}

/**
 * Context object available inside compiled templates (`on:build`) and when rendering components.
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
	styles?: Set<string>
	scripts?: Set<string>
	headScripts?: Set<string>
}
