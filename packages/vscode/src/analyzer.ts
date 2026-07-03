/** Re-export template analyzer from core (single source of truth). */
export {
	collectBuildScriptContentGlobalReferences,
	collectDefinedVariables,
	collectIdentifierReferences,
	collectTemplateReferences,
	collectTemplateScopes,
	collectVariablesByScope,
	maskJsComments,
	maskTemplateLiteralStatic,
} from '@aero-js/core/template-diagnostics'

export type {
	ScriptScope,
	TemplateReference,
	TemplateScope,
	VariableDefinition,
} from '@aero-js/core/template-diagnostics'
