/** Shared live script scanning for VS Code providers. */
export {
	classifyTemplateScriptTag as classifyScriptTag,
	collectTemplateScriptBlocks as parseScriptBlocks,
	type TemplateScriptBlock as ParsedScriptBlock,
	type TemplateScriptKind as ScriptTagKind,
} from '@aero-js/compiler'
