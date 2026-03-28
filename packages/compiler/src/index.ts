/**
 * @aero-js/compiler - Standalone HTML template compiler
 *
 * A fast, HTML-first template engine that compiles templates to JavaScript render functions.
 * No custom file extensions, no framework lock-in.
 */

// Compiler
export { compile, compileTemplate } from './codegen'
export { parse } from './parser'

// Types
export type {
	CompileOptions,
	ParseResult,
	ScriptEntry,
	ResolverOptions,
	CodegenTarget,
	EmitRenderFunctionOptions,
	CompileErrorOptions,
} from './types'
export { CompileError } from './types'

// IR
export type { IRNode, IRAppend, IRFor, IRIf, IRSlot, IRSlotVar, IRComponent } from './ir'

// Helpers (for advanced use cases)
export * from './helpers'

// Constants
export * from './constants'

// Directive attributes
export { isDirectiveAttr, isComponentAttr } from './directive-attributes'

// Resolver
export { Resolver } from './resolver'

// Path utilities
export { toPosix } from './path'

// Build script analysis
export { analyzeBuildScript, stripBuildScriptTypes } from './build-script-analysis'

// Tokenizer (re-exported from @aero-js/interpolation)
export {
	tokenizeCurlyInterpolation,
	compileInterpolationFromSegments,
	type Segment,
	type LiteralSegment,
	type InterpolationSegment,
} from '@aero-js/interpolation'
