/** Node-only template diagnostics for IDE adapters and `aero check`. */
export {
	collectTemplateDiagnostics,
	parseDocument,
	getResolver,
	clearResolverCache,
	type CollectTemplateDiagnosticsInput,
	type ParsedDocument,
	type PathResolver,
	type SourceDocument,
	type SourceRange,
	type SourcePosition,
} from './template-diagnostics/index'
