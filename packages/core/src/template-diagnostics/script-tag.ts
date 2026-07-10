/** Shared live script scanning for template diagnostics. */
export {
	classifyTemplateScriptTag as classifyScriptTag,
	collectTemplateScriptBlocks as parseScriptBlocks,
	type TemplateScriptBlock as ParsedScriptBlock,
	type TemplateScriptKind as ScriptTagKind,
} from '@aero-js/compiler'
