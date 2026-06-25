/**
 * Shared constants for the Aero compiler (parser, codegen, helpers).
 *
 * @remarks
 * Build directives accept bare names or optional `aero-*` / `data-aero-*` prefixes. Script taxonomy uses
 * `is:build`, `is:state`, `is:inline`, `is:blocking`; default scripts are treated as client (virtual module).
 * When changing script taxonomy (is:build, is:inline, etc.), update all consumers per
 * _reference/script-taxonomy-sync.md.
 */

/** Prefix for namespaced Aero directives (e.g. `aero-for`). */
export const AERO_ATTR_PREFIX = 'aero-'
/** Prefix for data-namespaced Aero directives (e.g. `data-aero-for`). */
export const DATA_AERO_ATTR_PREFIX = 'data-aero-'
/** @deprecated Legacy `data-*` prefix; accepted as Prettier input only, not by the compiler. */
export const LEGACY_BUILD_ATTR_PREFIX = 'data-'

/** Prettier / formatter output mode for build directive attribute names. */
export type BuildDirectivePrefixMode = 'none' | 'aero' | 'data-aero'

/** Attribute for spreading props onto a component: `props` or `aero-props="{ ... }"`. */
export const ATTR_PROPS = 'props'
/** Attribute for iteration: `for` or `aero-for="{ const item of items }"`. */
export const ATTR_FOR = 'for'
export const ATTR_IF = 'if'
export const ATTR_ELSE_IF = 'else-if'
export const ATTR_ELSE = 'else'
/** Structural switch container: `switch` / `aero-switch`. */
export const ATTR_SWITCH = 'switch'
/** Switch branch: `case` / `aero-case`. */
export const ATTR_CASE = 'case'
/** Switch fallback: `default` / `aero-default`. */
export const ATTR_DEFAULT = 'default'
/** Key for reactive keyed loops: `key` / `aero-key`. */
export const ATTR_KEY = 'key'
/** Slot name (on `<slot>` or content). */
export const ATTR_NAME = 'name'
export const ATTR_SLOT = 'slot'
/** Script runs at build time; extracted and becomes render function body. */
export const ATTR_IS_BUILD = 'is:build'
/** Script declares reactive state; extracted for phase-2 reactivity pipeline. */
export const ATTR_IS_STATE = 'is:state'
/** Script left in template in place; not extracted. */
export const ATTR_IS_INLINE = 'is:inline'
/** Script hoisted to head; extracted. */
export const ATTR_IS_BLOCKING = 'is:blocking'
/** Script external source (HTML attribute). */
export const ATTR_SRC = 'src'

export const TAG_SLOT = 'slot'
/**
 * HTML `<template>` tag name. For lowering, prefer `template.content.childNodes` over `childNodes`
 * alone — see `getEffectiveChildNodes` in `lowerer/template.ts`.
 */
export const TAG_TEMPLATE = 'template'
/** Default slot name when no name is given. */
export const SLOT_NAME_DEFAULT = 'default'

/** Matches tag names ending with `-component` or `-layout`. */
export const COMPONENT_SUFFIX_REGEX = /-(component|layout)$/

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
