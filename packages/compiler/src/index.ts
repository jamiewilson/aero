/**
 * @aero-js/compiler - Standalone HTML template compiler
 *
 * A fast, HTML-first template compiler that compiles templates to JavaScript render functions.
 */

export { CodeBuilder } from './code-builder'
export { compile, compileTemplate, compileTemplateModule, type CompiledTemplateModule } from './codegen'
export {
	buildTemplateSourceMap,
	collectTemplateSourceMapSites,
	findBarePropsAttributeOffset,
	type EncodedTemplateSourceMap,
	type TemplateSourceMapSite,
} from './template-source-map'
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
	buildTemplateInterpolationVirtualText,
	formatInterpolationBinderPrelude,
	formatInterpolationBinderPreludeFromTemplate,
	EVENT_HANDLER_SCOPE_DECL,
	type TemplateInterpolationSite,
} from './template-interpolation-sites'
export {
	analyzeTemplateSource,
	classifyTemplateScriptTag,
	collectHtmlCommentRanges,
	collectTemplateScriptBlocks,
	maskHtmlComments,
	type TemplateScriptBlock,
	type TemplateScriptKind,
	type TemplateSourceAnalysis,
	type TemplateSourceRange,
} from './template-source'
export { rewriteHypermediaActionStateRefs, COMPILED_HYPERMEDIA_STATE_SIGNAL_CALLEE, type RewriteHypermediaActionStateRefsOptions } from './hypermedia-action-state-refs'
export {
	HYPERMEDIA_HTTP_METHODS,
	HYPERMEDIA_SIGNAL_RESOLVER,
	HYPERMEDIA_EVENT_HANDLER_ACTIONS,
	HYPERMEDIA_HTTP_METHOD_SET,
	HYPERMEDIA_EVENT_HANDLER_ACTION_SET,
	HYPERMEDIA_COMPILED_SIGNAL_CALLEE,
	buildHypermediaActionScopeDecl,
	type HypermediaHttpMethod,
} from './event-handler-action-scope'
export {
	createEventHandlerActionScope,
	type EventHandlerActionExecutor,
} from './create-event-handler-action-scope'

export {
	collectFeatureGateIssues,
	collectFeatureGateIssuesFromSource,
	type FeatureGateFlags,
	type FeatureGateIssue,
} from './feature-gates'

export {
	collectReactiveBindingIssuesFromHtml,
	collectReactiveScopeIssues,
	type ReactiveScopeIssue,
} from './collect-reactive-binding-issues'
export { validateReactiveScopeRefs } from './validate-reactive-scope-refs'

export {
	HYPERMEDIA_PACKAGE_SPECIFIER,
	HYPERMEDIA_BUILD_IMPORT_MESSAGE,
	HYPERMEDIA_STATE_IMPORT_MESSAGE,
	isHypermediaActionImport,
	collectHypermediaActionImportsInBuildScript,
	collectMissingHypermediaActionImportsInStateScript,
	type HypermediaBuildImportHit,
	type HypermediaMissingStateImportHit,
} from './hypermedia-build-imports'

export {
	collectComponentReactivePropMetadata,
	collectComponentRegistryEntries,
	renderComponentRegistryDts,
	writeComponentRegistryDts,
	DEFAULT_COMPONENT_REGISTRY_REL,
	type ComponentRegistryEntry,
} from './component-registry-codegen'
export { emitClientScriptTag, VIRTUAL_PREFIX } from './emit-client-script-tag'
export {
	AERO_JSON_SCRIPT_TYPE,
	AERO_JSON_ROLE_PROPS,
	AERO_JSON_ROLE_STATE,
	aeroJsonScriptOpenTag,
	aeroJsonScriptRoleSelector,
	emitAeroJsonScriptTagTemplate,
	type AeroJsonScriptRole,
} from './json-script-payload'
export { parse } from './parser'

// Types
export type {
	CompileOptions,
	CompileWarning,
	ParseResult,
	ScriptEntry,
	ResolverOptions,
	CodegenTarget,
	ComponentReactivePropMetadata,
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
	lineColumnAtOffset,
	locateInTemplateSource,
	locateInEmbeddedScript,
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
	type LocateInTemplateSourceOptions,
	type TemplateSourceLocation,
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
	collectReadonlyReactivePropWritesInExpression,
	readonlyReactivePropWriteMessage,
	type ReadonlyReactivePropWrite,
} from './readonly-reactive-prop-writes'

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
	attributeHasExplicitValueInSource,
	resolveRuntimeDirectiveHasValue,
	runtimeDirectiveRequiresBracedValue,
	getRuntimeDirectiveBraceIssue,
	type RuntimeDirectiveBraceInput,
} from './runtime-directive-braces'
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
	classifyBuildAttribute,
	getBuildDirectiveValidationIssue,
	isBuildDirectiveAttribute,
	isBuildDirectiveAttributeForFormatting,
	formatBuildDirectiveName,
	resolveBuildDirectiveName,
	resolveBuildDirectiveNameForFormatting,
	buildDirectiveAttributeNames,
	hasBuildDirectiveAttribute,
	getBuildDirectiveAttribute,
	isPrefixedBuildDirectiveName,
	type BuildDirective,
	type BuildDirectivePrefixMode,
	type ClassifyBuildAttributeInput,
	type BuildAttributeClassification,
} from './build-directive-attributes'

// Reactive attribute bind dispatch (compiler lowerer)
export {
	REACTIVE_BIND_DISPATCH_ORDER,
	classifyReactiveAttribute,
	type ReactiveBindDispatchStep,
	type ClassifyReactiveAttributeInput,
	type ReactiveAttributeClassification,
} from './reactive-attribute-classification'

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
