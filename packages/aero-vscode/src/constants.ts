/**
 * Constants for the Aero VS Code extension: regexes, attribute names, selectors, path resolution.
 *
 * @remarks
 * Directive attributes and build-script analysis come from @aerobuilt/core/editor.
 */
import * as vscode from 'vscode'
import {
	isDirectiveAttr as coreIsDirectiveAttr,
	DEFAULT_DIRECTIVE_PREFIXES as CORE_DEFAULT_DIRECTIVE_PREFIXES,
} from '@aerobuilt/core/editor'

/** Matches component/layout suffix on tag names: `-component` or `-layout`. */
export const COMPONENT_SUFFIX_REGEX = /-(component|layout)$/

/** Default directive prefixes (from core/editor). */
export const DEFAULT_DIRECTIVE_PREFIXES: string[] = CORE_DEFAULT_DIRECTIVE_PREFIXES

/** Returns true if the attribute is a directive that should skip Aero interpolation. */
export const isDirectiveAttr = coreIsDirectiveAttr

export const ATTR_IS_BUILD = 'is:build'
export const ATTR_IS_INLINE = 'is:inline'

/** Content globals: identifier → alias path. Files in `client/content/` are exposed as globals in Aero templates. */
export const CONTENT_GLOBALS: Record<string, string> = {
	site: '@content/site',
	theme: '@content/theme',
}

/** Document selector for Aero-relevant HTML files (language: html, scheme: file). */
export const HTML_SELECTOR: vscode.DocumentSelector = { language: 'html', scheme: 'file' }

/** Extensions to try when resolving imports without an extension. */
export const RESOLVE_EXTENSIONS = ['.html', '.ts', '.js', '.json']
