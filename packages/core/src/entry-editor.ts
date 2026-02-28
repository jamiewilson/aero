/**
 * Slim editor surface for IDE extensions (e.g. aero-vscode).
 *
 * Exports only tokenizer, directive attributes, and build-script analysis with
 * source ranges. Does not pull in runtime, Vite, linkedom, or Nitro.
 *
 * @packageDocumentation
 */

export {
	tokenizeCurlyInterpolation,
	compileInterpolationFromSegments,
	type Segment,
	type LiteralSegment,
	type InterpolationSegment,
	type TokenizeOptions,
} from './compiler/tokenizer'

export {
	isDirectiveAttr,
	DEFAULT_DIRECTIVE_PREFIXES,
	type DirectiveAttrConfig,
} from './compiler/directive-attributes'

export {
	analyzeBuildScriptForEditor,
	type BuildScriptImportForEditor,
	type BuildScriptAnalysisForEditorResult,
} from './compiler/build-script-analysis'
