/**
 * @aero-js/compiler - Standalone HTML template compiler
 *
 * A fast, HTML-first template engine that compiles templates to JavaScript render functions.
 * No custom file extensions, no framework lock-in.
 */

// Compiler
export { CodeBuilder } from './code-builder'
export { compile, compileTemplate } from './codegen'
export type { TemplateAnalysis } from './template-analysis'
export { buildTemplateAnalysis } from './template-analysis'
export { emitClientScriptTag, VIRTUAL_PREFIX } from './emit-client-script-tag'
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

// for…of directive (editor + compiler)
export { parseForDirective, collectForDirectiveBindingNames } from './for-directive'
export type { ParsedForDirective } from './for-directive'

// Directive attributes
export { isDirectiveAttr, isComponentAttr } from './directive-attributes'

// Resolver
export { Resolver } from './resolver'

// Path utilities
export { toPosix } from './path'

// Build script analysis
export {
	analyzeBuildScript,
	stripBuildScriptTypes,
	extractBuildScriptTypeDeclarationTexts,
} from './build-script-analysis'

// Build scope ambient (language server)
export {
	collectBuildScriptTypeDeclarationTexts,
	formatBuildScopeAmbientPrelude,
} from './build-scope-bindings'

// TypeScript checker (optional peer `typescript`; for tooling / Phase C)
export {
	collectBindingTypeStringsFromBuildScript,
	collectBindingTypeStringsFromBuildScripts,
	getBindingTypeStringFromBuildScript,
} from './build-script-type-inference'

// Tokenizer (re-exported from @aero-js/interpolation)
export {
	tokenizeCurlyInterpolation,
	compileInterpolationFromSegments,
	type Segment,
	type LiteralSegment,
	type InterpolationSegment,
} from '@aero-js/interpolation'
