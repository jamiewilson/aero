/**
 * Constants for the Aero VS Code extension: regexes, attribute names, selectors, path resolution.
 *
 * @remarks
 * Regex patterns mirror `packages/core/compiler/constants.ts` for consistent parsing. Used by analyzer, positionAt, and providers.
 */
import * as vscode from 'vscode'

/** Matches component/layout suffix on tag names: `-component` or `-layout`. */
export const COMPONENT_SUFFIX_REGEX = /-(component|layout)$/

/** Matches import statements: `import X from 'path'` */
export const IMPORT_REGEX =
	/((?:^|[\r\n;])\s*)import\s+(?:(\w+)|\{([^}]+)\}|\*\s+as\s+(\w+))\s+from\s+(['"])(.+?)\5/g

/** Alpine.js attributes that should not be treated as Aero expressions (`x-*`, `@*`, `:*`, `.*`). */
export const ALPINE_ATTR_REGEX = /^(x-|[@:.]).*/

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
