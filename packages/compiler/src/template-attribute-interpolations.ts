import { tokenizeCurlyInterpolation } from '@aero-js/interpolation'
import { walkHtmlNodes, type Node } from '@aero-js/html-parser'
import { AERO_ATTR_PREFIX, ATTR_FOR, ATTR_PROPS, DATA_AERO_ATTR_PREFIX } from './constants'
import { isDirectiveAttr } from './directive-attributes'
import { normalizeRuntimeDirectiveName } from './runtime-directive-attributes'

const FOR_ATTR_NAMES = new Set(['for', `${AERO_ATTR_PREFIX}for`, `${DATA_AERO_ATTR_PREFIX}for`])
const PROPS_ATTR_NAMES = new Set([
	ATTR_PROPS.toLowerCase(),
	`${AERO_ATTR_PREFIX}${ATTR_PROPS}`.toLowerCase(),
	`${DATA_AERO_ATTR_PREFIX}${ATTR_PROPS}`.toLowerCase(),
])

const ATTR_REGEX = /(?:\s|^)([a-zA-Z0-9\-:@.]+)(?:(\s*=\s*)(['"])([\s\S]*?)\3)?/gi

export type TemplateAttributeMask = { start: number; length: number }

export type TemplateAttributeInterpolation = {
	readonly expression: string
	readonly sourceOffset: number
	readonly wrapPropsObjectLiteral?: boolean
	readonly isEventHandler?: boolean
}

export type TemplateAttributeWalkItem = {
	readonly name: string
	readonly value: string
	readonly absNameStart: number
	readonly absValueStart: number
	readonly hasValue: boolean
	readonly isAlpine: boolean
	readonly node: Node
}

function isPropsLikeAttribute(name: string): boolean {
	return PROPS_ATTR_NAMES.has(name.toLowerCase())
}

/** Walk quoted attributes on template HTML nodes with absolute source offsets. */
export function* walkTemplateAttributes(
	roots: readonly Node[],
	sourceText: string
): Generator<TemplateAttributeWalkItem> {
	for (const node of walkHtmlNodes(roots)) {
		if (!node.tag || node.startTagEnd == null) continue
		const tag = node.tag.toLowerCase()
		if (tag === 'script' || tag === 'style') continue

		const open = sourceText.substring(node.start, node.startTagEnd)
		const nameMatch = open.match(/^<\s*\/?\s*([a-zA-Z][\w-]*)/)
		if (!nameMatch) continue

		const attrsStart = node.start + nameMatch[0].length
		const gt = open.lastIndexOf('>')
		const attrsContent = gt > nameMatch[0].length ? open.slice(nameMatch[0].length, gt) : ''

		ATTR_REGEX.lastIndex = 0
		let attrMatch: RegExpExecArray | null

		while ((attrMatch = ATTR_REGEX.exec(attrsContent)) !== null) {
			const fullMatch = attrMatch[0]
			const name = attrMatch[1]
			const hasValue = !!attrMatch[3]
			const value = attrMatch[4] || ''

			const matchStartInAttrs = attrMatch.index
			const nameStartInMatch = fullMatch.indexOf(name)
			const absNameStart = attrsStart + matchStartInAttrs + nameStartInMatch

			let absValueStart = absNameStart
			if (hasValue) {
				const quote = attrMatch[3]
				const quoteIndex = fullMatch.indexOf(quote, nameStartInMatch + name.length)
				absValueStart = attrsStart + matchStartInAttrs + quoteIndex + 1
			}

			yield {
				name,
				value,
				absNameStart,
				absValueStart,
				hasValue,
				isAlpine: name.startsWith(':') || name.startsWith('@') || name.startsWith('x-'),
				node,
			}
		}
	}
}

export type WalkTemplateAttributeInterpolationsOptions = {
	/** When true, skip Aero site extraction for non-event directive attrs. */
	readonly skipNonEventDirectives?: boolean
}

/**
 * Collect Aero `{ }` attribute interpolation sites and value masks for text scanning.
 *
 * @remarks
 * Shared by compiler interpolation site discovery and VS Code reference analysis.
 */
export function walkTemplateAttributeInterpolations(
	roots: readonly Node[],
	sourceText: string,
	options: WalkTemplateAttributeInterpolationsOptions = {}
): {
	readonly interpolations: TemplateAttributeInterpolation[]
	readonly masks: TemplateAttributeMask[]
} {
	const interpolations: TemplateAttributeInterpolation[] = []
	const masks: TemplateAttributeMask[] = []
	const skipNonEventDirectives = options.skipNonEventDirectives ?? true

	for (const attr of walkTemplateAttributes(roots, sourceText)) {
		if (!attr.hasValue || !attr.value) continue

		if (skipNonEventDirectives) {
			const runtimeDirective = normalizeRuntimeDirectiveName(attr.name)
			if (isDirectiveAttr(attr.name) && runtimeDirective?.family !== 'event') {
				masks.push({ start: attr.absValueStart, length: attr.value.length })
				continue
			}
		}

		if (FOR_ATTR_NAMES.has(attr.name)) continue

		const wrapPropsObjectLiteral = isPropsLikeAttribute(attr.name)
		const runtimeDirective = normalizeRuntimeDirectiveName(attr.name)
		const isEventHandler = runtimeDirective?.family === 'event'

		masks.push({ start: attr.absValueStart, length: attr.value.length })

		const segments = tokenizeCurlyInterpolation(attr.value, { attributeMode: true })
		for (const seg of segments) {
			if (seg.kind !== 'interpolation') continue
			const expr = seg.expression
			if (!expr.trim()) continue
			interpolations.push({
				expression: expr,
				sourceOffset: attr.absValueStart + seg.start + 1,
				...(wrapPropsObjectLiteral ? { wrapPropsObjectLiteral: true as const } : {}),
				...(isEventHandler ? { isEventHandler: true as const } : {}),
			})
		}
	}

	return { interpolations, masks }
}

export function applyTemplateAttributeMasks(text: string, masks: readonly TemplateAttributeMask[]): string {
	let result = text
	for (const mask of masks) {
		result =
			result.substring(0, mask.start) +
			' '.repeat(mask.length) +
			result.substring(mask.start + mask.length)
	}
	return result
}
