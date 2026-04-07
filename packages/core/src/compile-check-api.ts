/**
 * Minimal compile surface for Node-only checks (e.g. `aero check`).
 *
 * @remarks
 * Kept separate from the browser entry so consumers do not pull codegen into client bundles.
 */
export {
	compileTemplate,
	checkTemplateTypes,
	checkTemplateTypesWithFile,
	checkTemplateBuildScriptTypes,
	checkTemplateBuildScriptTypesWithFile,
	loadProjectTsConfig,
	writeComponentRegistryDts,
} from '@aero-js/compiler'
export {
	buildRouteManifest,
	buildRouteManifestWithDiagnostics,
	writeRouteManifestGenerated,
} from './routing/route-manifest'
export {
	renderRouteTypesDts,
	renderRouteHelpersTs,
	writeRouteTypesGenerated,
} from './routing/route-typegen'
export type {
	BuildScriptTypeIssue,
	TemplateTypeIssue,
	CheckTemplateTypesOptions,
} from '@aero-js/compiler'
export type {
	RouteManifestEntry,
	RouteManifestFile,
	RouteManifestDiagnostic,
	RouteManifestBuildResult,
} from './routing/route-manifest'
