export type {
	ShikiConfig,
	ShikiConfigSingleTheme,
	ShikiConfigMultipleThemes,
} from './types'
export { highlight, getHighlighter, resetHighlighter } from './highlighter'
export { preDataLangTransformer } from './transformers'
export { aeroHtmlGrammar, AERO_HTML_LANG } from './grammars/aero-html'
