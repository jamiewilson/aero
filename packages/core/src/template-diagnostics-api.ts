/** Node-only template diagnostics for IDE adapters and `aero check`. */
export {
	collectTemplateDiagnostics,
	parseDocument,
	getResolver,
	clearResolverCache,
	findAeroProjectRoot,
	isAeroProjectPath,
	type CollectTemplateDiagnosticsInput,
	type ParsedDocument,
	type PathResolver,
	type SourceDocument,
	type SourceRange,
	type SourcePosition,
} from './template-diagnostics/index'

export {
	collectBuildScriptContentGlobalReferences,
	collectDefinedVariables,
	collectIdentifierReferences,
	collectTemplateReferences,
	collectTemplateScopes,
	collectVariablesByScope,
	maskJsComments,
	maskTemplateLiteralStatic,
} from './template-diagnostics/analyzer'

export type {
	ScriptScope,
	TemplateReference,
	TemplateScope,
	VariableDefinition,
} from './template-diagnostics/analyzer'
