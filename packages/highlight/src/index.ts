export type {
	ShikiConfig,
	ShikiConfigSingleTheme,
	ShikiConfigMultipleThemes,
} from './types'
export { highlight, getHighlighter, resetHighlighter } from './highlighter'
export { addPreDataLang } from './transformers'
export { aeroHtml, AERO_HTML_LANG } from './grammars/aero-html'
