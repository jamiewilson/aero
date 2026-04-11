/**
 * @aero-js/compiler - Standalone HTML template compiler
 *
 * A fast, HTML-first template compiler that compiles templates to JavaScript render functions.
 */

export { CodeBuilder } from './code-builder'
export { compile, compileTemplate } from './codegen'
export { buildTemplateAnalysis, type TemplateAnalysis } from './template-analysis'

export {
	buildTemplateEditorAmbient,
	getTemplateEditorAmbientFromParsed,
	type TemplateEditorAmbient,
} from './template-editor-context'

export {
	checkTemplateTypes,
	checkTemplateTypesWithFile,
	checkTemplateBuildScriptTypes,
	checkTemplateBuildScriptTypesWithFile,
	type BuildScriptTypeIssue,
	type TemplateTypeIssue,
	type TemplateTypeIssueKind,
	type CheckTemplateTypesOptions,
} from './template-type-check'

export {
	loadProjectTsConfig,
	compilerOptionsForVirtualCheck,
	type LoadedProjectTsConfig,
} from './project-tsconfig'

export {
	collectTemplateInterpolationSites,
	formatInterpolationBinderPrelude,
	formatInterpolationBinderPreludeFromTemplate,
	type TemplateInterpolationSite,
} from './template-interpolation-sites'

export {
	collectComponentRegistryEntries,
	renderComponentRegistryDts,
	writeComponentRegistryDts,
	DEFAULT_COMPONENT_REGISTRY_REL,
	type ComponentRegistryEntry,
} from './component-registry-codegen'
export { emitClientScriptTag, VIRTUAL_PREFIX } from './emit-client-script-tag'
export { parse } from './parser'

// Types
export type {
	CompileOptions,
	CompileWarning,
	ParseResult,
	ScriptEntry,
	ResolverOptions,
	CodegenTarget,
	EmitRenderFunctionOptions,
	CompileErrorOptions,
} from './types'

export { CompileError } from './types'

// IR
export type {
	IRNode,
	IRAppend,
	IRFor,
	IRIf,
	IRSwitch,
	IRSwitchCase,
	IRSlot,
	IRSlotVar,
	IRComponent,
} from './ir'

// Helpers
export {
	escapeCodegenTemplateBody,
	escapeHtmlAttributeLiteral,
	escapeTemplateLiteralContent,
	escapeHtml,
	escapeScriptJson,
	validateSingleBracedExpression,
	compileInterpolation,
	compileAttributeInterpolation,
	isAttr,
	stripBraces,
	kebabToCamelCase,
	buildPropsString,
	escapeBackticks,
	raw,
	emitSlotsObjectVars,
	emitRenderFunction,
	getRenderComponentContextArg,
	getRenderContextDestructurePattern,
	emitSlotVar,
	emitAppend,
	emitIf,
	emitElseIf,
	emitElse,
	emitEnd,
	emitSlotOutput,
	emitRenderComponentStatement,
	RENDER_INTERNAL_CONTEXT_KEYS,
	type ValidateSingleBracedExpressionOptions,
	type RenderFunctionOptions,
} from './helpers'

// Constants
export {
	ATTR_PREFIX,
	ATTR_PROPS,
	ATTR_FOR,
	ATTR_IF,
	ATTR_ELSE_IF,
	ATTR_ELSE,
	ATTR_SWITCH,
	ATTR_CASE,
	ATTR_DEFAULT,
	ATTR_NAME,
	ATTR_SLOT,
	ATTR_IS_BUILD,
	ATTR_IS_INLINE,
	ATTR_IS_BLOCKING,
	ATTR_SRC,
	TAG_SLOT,
	TAG_TEMPLATE,
	SLOT_NAME_DEFAULT,
	COMPONENT_SUFFIX_REGEX,
	VOID_TAGS,
} from './constants'

// for…of directive (editor + compiler)
export { parseForDirective, collectForDirectiveBindingNames } from './for-directive'
export { type ParsedForDirective } from './for-directive'

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
