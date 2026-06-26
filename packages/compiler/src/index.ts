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
	applyTemplateAttributeMasks,
	walkTemplateAttributeInterpolations,
	walkTemplateAttributes,
	type TemplateAttributeInterpolation,
	type TemplateAttributeMask,
	type TemplateAttributeWalkItem,
} from './template-attribute-interpolations'

export {
	collectTemplateInterpolationSites,
	buildTemplateInterpolationVirtualText,
	formatInterpolationBinderPrelude,
	formatInterpolationBinderPreludeFromTemplate,
	EVENT_HANDLER_SCOPE_DECL,
	type TemplateInterpolationSite,
} from './template-interpolation-sites'

export {
	collectComponentLivePropMetadata,
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
	ComponentLivePropMetadata,
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
	trim,
	trimStart,
	trimEnd,
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
	AERO_ATTR_PREFIX,
	DATA_AERO_ATTR_PREFIX,
	LEGACY_BUILD_ATTR_PREFIX,
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
	ATTR_IS_STATE,
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
export {
	parseForDirective,
	collectForDirectiveBindingNames,
	findForLoopImplicitNameShadows,
	FOR_LOOP_IMPLICIT_NAMES,
} from './for-directive'
export { type ParsedForDirective } from './for-directive'

export {
	analyzeStateScript,
	type StateBinding,
	type StateScriptDiagnostic,
	type StateScriptAnalysisResult,
} from './state-script-analysis'
export {
	collectReadonlyLivePropWritesInExpression,
	readonlyLivePropWriteMessage,
	type ReadonlyLivePropWrite,
} from './readonly-live-prop-writes'

export {
	annotateStateScriptForEditorTypecheck,
	type StateScriptTextMapping,
} from './state-script-editor-typecheck'

// Directive attributes
export { isDirectiveAttr, isComponentAttr } from './directive-attributes'
export {
	normalizeRuntimeDirectiveName,
	type NormalizedRuntimeDirective,
	type RuntimeDirectiveFamily,
} from './runtime-directive-attributes'
export {
	parseEventDirectiveName,
	type EventDirectiveParseResult,
	type ParsedEventDirective,
} from './event-directive-attributes'

// Build directive classification (compiler, prettier, VSCode)
export {
	BUILD_DIRECTIVES,
	NATIVE_BARE_ATTR_ELEMENTS,
	normalizeAttributeValue,
	looksBracedDirectiveValue,
	isBuildDirectiveName,
	isBuildDirectiveNameForFormatting,
	canonicalBuildDirectiveName,
	canonicalBuildDirectiveNameForFormatting,
	isNativeBareAttribute,
	isBuildDirectiveAttribute,
	isBuildDirectiveAttributeForFormatting,
	requiresBracedDirectiveValue,
	formatBuildDirectiveName,
	resolveBuildDirectiveName,
	resolveBuildDirectiveNameForFormatting,
	buildDirectiveAttributeNames,
	hasBuildDirectiveAttribute,
	getBuildDirectiveAttribute,
	isPrefixedBuildDirectiveName,
	type BuildDirective,
	type BuildDirectivePrefixMode,
} from './build-directive-attributes'

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

export {
	parsePropsAttributeBindings,
	formatPropsInjectedAmbientDecls,
	type BuildBindingProperties,
	type ParsedPropsAttribute,
} from './parse-props-attribute-bindings'

// Tokenizer (re-exported from @aero-js/interpolation)
export {
	tokenizeCurlyInterpolation,
	compileInterpolationFromSegments,
	type Segment,
	type LiteralSegment,
	type InterpolationSegment,
} from '@aero-js/interpolation'
