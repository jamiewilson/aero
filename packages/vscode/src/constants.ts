/**
 * Constants for the Aero VS Code extension: selectors and content globals.
 *
 * @remarks
 * COMPONENT_SUFFIX_REGEX is re-exported from @aero-js/core/editor so the extension stays in sync with the compiler. Other editor APIs (e.g. analyzeBuildScriptForEditor, isDirectiveAttr) are imported directly from @aero-js/core/editor where needed.
 */
import * as vscode from 'vscode'

export { COMPONENT_SUFFIX_REGEX } from '@aero-js/core/editor'

/** Content globals: identifier → alias path. Files in `client/content/` are exposed as globals in Aero templates. */
export const CONTENT_GLOBALS: Record<string, string> = {
	site: '@content/site',
	theme: '@content/theme',
}

/** Document selector for Aero-relevant files (html and aero language IDs, scheme: file). */
export const HTML_SELECTOR: vscode.DocumentSelector = [
	{ language: 'html', scheme: 'file' },
	{ language: 'aero', scheme: 'file' },
]
