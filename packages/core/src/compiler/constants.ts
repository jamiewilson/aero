/**
 * Shared constants for the Aero compiler (parser, codegen, helpers).
 *
 * @remarks
 * Attribute names are used with optional `data-` prefix (e.g. `data-each`). Script taxonomy uses
 * `is:build`, `is:inline`, `is:blocking`; default scripts are treated as client (virtual module).
 */

/** Prefix for data attributes (e.g. `data-each` → ATTR_PREFIX + ATTR_EACH). */
export const ATTR_PREFIX = 'data-'
/** Attribute for spreading props onto a component: `data-props` or `data-props="{ ... }"`. */
export const ATTR_PROPS = 'props'
/** Attribute for iteration: `data-each="{ item in items }"`. */
export const ATTR_EACH = 'each'
export const ATTR_IF = 'if'
export const ATTR_ELSE_IF = 'else-if'
export const ATTR_ELSE = 'else'
/** Slot name (on `<slot>` or content). */
export const ATTR_NAME = 'name'
export const ATTR_SLOT = 'slot'
/** Script runs at build time; extracted and becomes render function body. */
export const ATTR_IS_BUILD = 'is:build'
/** Script left in template in place; not extracted. */
export const ATTR_IS_INLINE = 'is:inline'
/** Script hoisted to head; extracted. */
export const ATTR_IS_BLOCKING = 'is:blocking'
/** Script receives data from template: `pass:data="{ config }"`. */
export const ATTR_PASS_DATA = 'pass:data'
/** Script external source (HTML attribute). */
export const ATTR_SRC = 'src'

export const TAG_SLOT = 'slot'
/** Default slot name when no name is given. */
export const SLOT_NAME_DEFAULT = 'default'

/** Matches `item in items` for data-each (captures: loop variable, iterable expression). */
export const EACH_REGEX = /^(\w+)\s+in\s+(.+)$/
/**
 * Matches `{ expression }` for interpolation (capture: expression).
 *
 * @deprecated Use the tokenizer in compiler/tokenizer.ts for correct nesting and string/comment
 *   handling. Kept for backwards compatibility (e.g. aero-vscode); core no longer uses this.
 */
export const CURLY_INTERPOLATION_REGEX = /{([\s\S]+?)}/g
/** Matches tag names ending with `-component` or `-layout`. */
export const COMPONENT_SUFFIX_REGEX = /-(component|layout)$/
/** Matches ES import statements for extraction (captures: default name, named bindings, namespace, quote, path). */
export const IMPORT_REGEX =
	/((?:^|[\r\n;])\s*)import\s+(?:(\w+)|\{([^}]+)\}|\*\s+as\s+(\w+))\s+from\s+(['"])(.+?)\5/g
/** Self-closing tag: `<tag ... />`. */
export const SELF_CLOSING_TAG_REGEX = /<([a-z0-9-]+)([^>]*?)\/>/gi
export const SELF_CLOSING_TAIL_REGEX = /\/>$/

/** Attribute names that should not be interpolated (Alpine.js, etc.): `x-*`, `@*`, `:*`, `.*`. */
export const ALPINE_ATTR_REGEX = /^(x-|[@:.]).*/
/** HTML void elements that have no closing tag. */
export const VOID_TAGS = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr',
])
