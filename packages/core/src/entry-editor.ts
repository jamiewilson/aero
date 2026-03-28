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
} from '@aero-js/interpolation'

export {
	isDirectiveAttr,
	DEFAULT_DIRECTIVE_PREFIXES,
	type DirectiveAttrConfig,
} from '@aero-js/template/directive-attributes'

export { COMPONENT_SUFFIX_REGEX } from '@aero-js/template/constants'

export {
	analyzeBuildScriptForEditor,
	getPropsTypeFromBuildScript,
	type BuildScriptImportForEditor,
	type BuildScriptAnalysisForEditorResult,
	type PropsTypeResult,
} from '@aero-js/template/build-script-analysis'
