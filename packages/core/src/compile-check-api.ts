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
export type {
	BuildScriptTypeIssue,
	TemplateTypeIssue,
	CheckTemplateTypesOptions,
} from '@aero-js/compiler'
