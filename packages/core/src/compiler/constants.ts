export const ATTR_PREFIX = 'data-'
export const ATTR_PROPS = 'props'
export const ATTR_EACH = 'each'
export const ATTR_IF = 'if'
export const ATTR_ELSE_IF = 'else-if'
export const ATTR_ELSE = 'else'
export const ATTR_NAME = 'name'
export const ATTR_SLOT = 'slot'
export const ATTR_ON_CLIENT = 'on:client'
export const ATTR_ON_BUILD = 'on:build'

export const TAG_SLOT = 'slot'
export const SLOT_NAME_DEFAULT = 'default'

export const EACH_REGEX = /^(\w+)\s+in\s+(.+)$/
export const CURLY_INTERPOLATION_REGEX = /{([\s\S]+?)}/g
export const COMPONENT_SUFFIX_REGEX = /-(component|layout)$/
export const IMPORT_REGEX =
	/((?:^|[\r\n;])\s*)import\s+(?:(\w+)|\{([^}]+)\}|\*\s+as\s+(\w+))\s+from\s+(['"])(.+?)\5/g
export const SELF_CLOSING_TAG_REGEX = /<([a-z0-9-]+)([^>]*?)\/>/gi
export const SELF_CLOSING_TAIL_REGEX = /\/>$/

export const ALPINE_ATTR_REGEX = /^(x-|[@:.]).*/
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
