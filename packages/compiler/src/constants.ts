/**
 * Shared constants for the Aero compiler (parser, codegen, helpers).
 *
 * @remarks
 * Attribute names are used with optional `data-` prefix (e.g. `data-for`). Script taxonomy uses
 * `is:build`, `is:inline`, `is:blocking`; default scripts are treated as client (virtual module).
 * When changing script taxonomy (is:build, is:inline, etc.), update all consumers per
 * _reference/script-taxonomy-sync.md.
 */

/** Prefix for data attributes (e.g. `data-for` → ATTR_PREFIX + ATTR_FOR). */
export const ATTR_PREFIX = 'data-'
/** Attribute for spreading props onto a component: `data-props` or `data-props="{ ... }"`. */
export const ATTR_PROPS = 'props'
/** Attribute for iteration: `data-for="{ const item of items }"`. */
export const ATTR_FOR = 'for'
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
