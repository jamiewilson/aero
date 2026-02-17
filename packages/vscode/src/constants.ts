import * as vscode from 'vscode'

// ---------------------------------------------------------------------------
// Regex patterns mirroring packages/core/compiler/constants.ts
// ---------------------------------------------------------------------------

/** Matches component/layout suffix on tag names: `-component` or `-layout` */
export const COMPONENT_SUFFIX_REGEX = /-(component|layout)$/

/** Matches import statements: `import X from 'path'` */
export const IMPORT_REGEX =
	/import\s+(?:(\w+)|\{([^}]+)\}|\*\s+as\s+(\w+))\s+from\s+(['"])(.+?)\4/g

/** Matches `{ ... }` expressions in template text */
export const CURLY_INTERPOLATION_REGEX = /{([\s\S]+?)}/g

/** Alpine.js attributes that should NOT be treated as Aero expressions */
export const ALPINE_ATTR_REGEX = /^(x-|[@:.]).*/

// ---------------------------------------------------------------------------
// Aero attribute names
// ---------------------------------------------------------------------------

export const ATTR_ON_BUILD = 'on:build'
export const ATTR_ON_CLIENT = 'on:client'

// ---------------------------------------------------------------------------
// Content globals mapping: identifier -> alias path
// Files in client/content/ are exposed as globals in Aero templates.
// ---------------------------------------------------------------------------

export const CONTENT_GLOBALS: Record<string, string> = {
	site: '@content/site',
	theme: '@content/theme',
}

// ---------------------------------------------------------------------------
// Document selector for Aero-relevant HTML files
// ---------------------------------------------------------------------------

export const HTML_SELECTOR: vscode.DocumentSelector = { language: 'html', scheme: 'file' }

// ---------------------------------------------------------------------------
// Path-related constants
// ---------------------------------------------------------------------------

/** Extensions to try when resolving imports without an extension */
export const RESOLVE_EXTENSIONS = ['.html', '.ts', '.js', '.json']
