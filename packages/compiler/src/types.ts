/**
 * Shared type definitions for the @aero-js/compiler.
 */

/**
 * Single script entry: attrs (optional), content (body or virtual URL), optional props expression.
 */
export interface ScriptEntry {
	attrs?: string
	content: string
	passDataExpr?: string
	injectInHead?: boolean
}

/**
 * Options for the path resolver (e.g. resolving `@components/foo` to a file path).
 */
export interface ResolverOptions {
	root: string
	resolvePath?: (specifier: string, importer: string) => string
	importer?: string
}

/**
 * Input to the codegen compiler for a single template.
 */
export interface CompileOptions {
	root: string
	clientScripts?: ScriptEntry[]
	inlineScripts?: ScriptEntry[]
	blockingScripts?: ScriptEntry[]
	resolvePath?: (specifier: string, importer: string) => string
	importer?: string
	diagnosticTemplateSource?: string
	onWarning?: (warning: CompileWarning) => void
}

export interface CompileWarning {
	code: 'AERO_TEMPLATE' | 'AERO_SWITCH'
	message: string
	file?: string
	line?: number
	column?: number
}

/**
 * Result of parsing one HTML template.
 */
export interface ParseResult {
	buildScript: { content: string } | null
	clientScripts: ScriptEntry[]
	inlineScripts: ScriptEntry[]
	blockingScripts: ScriptEntry[]
	template: string
}

/**
 * Abstraction for runtime-specific code generation.
 * Allows the compiler to emit code for any runtime, not just Aero.
 */
export interface CodegenTarget {
	renderFunctionName: string
	contextProperties: string[]
	renderComponentCall: string
	internalContextKeys: string[]
	forwardPageAndSite: boolean
	emitRenderWrapper: (script: string, body: string, options?: EmitRenderFunctionOptions) => string
}

/**
 * Options for emitRenderFunction.
 */
export interface EmitRenderFunctionOptions {
	getStaticPathsFn?: string | null
	rootStyles?: string[]
	rootScripts?: string[]
	styleCode?: string
	rootScriptsLines?: string[]
	headScriptsLines?: string[]
}

/**
 * Error with optional source location for diagnostics.
 */
export interface CompileErrorOptions {
	message: string
	file?: string
	line?: number
	column?: number
}

/**
 * Base class for compile errors that can carry source location.
 */
export class CompileError extends Error {
	readonly file?: string
	readonly line?: number
	readonly column?: number

	constructor(options: CompileErrorOptions) {
		super(options.message)
		this.name = 'CompileError'
		this.file = options.file
		this.line = options.line
		this.column = options.column
	}
}
