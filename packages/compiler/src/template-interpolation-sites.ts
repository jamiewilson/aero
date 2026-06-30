/**
 * Collect `{ expression }` sites in a template for type-checking (same rules as the language server virtual TS blocks).
 *
 * @remarks
 * Kept aligned with `packages/language-server/src/virtualCode.ts` interpolation extraction.
 */

import { escapeInterpolationBodyMarkup, tokenizeCurlyInterpolation } from '@aero-js/interpolation'
import { parseMinimalHtmlFromText, walkHtmlNodes, type Node } from '@aero-js/html-parser'
import { formatBuildScopeAmbientPrelude } from './build-scope-bindings'
import { collectForDirectiveBindingNames, FOR_LOOP_IMPLICIT_NAMES } from './for-directive'
import { isDirectiveAttr } from './directive-attributes'
import { normalizeRuntimeDirectiveName } from './runtime-directive-attributes'
import { buildTemplateEditorAmbient } from './template-editor-context'
import { rewriteHypermediaActionStateRefs } from './hypermedia-action-state-refs'
import { AERO_ATTR_PREFIX, ATTR_FOR, ATTR_PROPS, DATA_AERO_ATTR_PREFIX } from './constants'
import { buildDirectiveAttributeNames } from './build-directive-attributes'

export type TemplateInterpolationSite = {
	readonly expression: string
	/** Absolute offset of `{` in the HTML source. */
	readonly braceOffset: number
	/**
	 * When true, virtual TS uses `[{ expr }]` instead of `[expr]` so object/spread props
	 * (e.g. `props="{ ...x }"`) typecheck as object spread, not array spread.
	 */
	readonly wrapPropsObjectLiteral?: boolean
	/** Aero `on:*` event handler — type-check as statement with writable state bindings. */
	readonly isEventHandler?: boolean
}

const FOR_ATTR_NAMES = new Set(['for', `${AERO_ATTR_PREFIX}for`, `${DATA_AERO_ATTR_PREFIX}for`])
const PROPS_ATTR_NAMES = new Set([
	ATTR_PROPS.toLowerCase(),
	`${AERO_ATTR_PREFIX}${ATTR_PROPS}`.toLowerCase(),
	`${DATA_AERO_ATTR_PREFIX}${ATTR_PROPS}`.toLowerCase(),
])

/** Hypermedia action functions injected into `on:*` handler scope at mount (reactivity mount compileHandler). */
export const HYPERMEDIA_ACTION_SCOPE_DECL = `interface HypermediaResponse {
	readonly ok: boolean
	readonly status: number
	readonly html: string
	readonly headers: Record<string, string>
}
interface HypermediaActionOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
	target?: string
	swap?: string
	headers?: Record<string, string>
	values?: Record<string, string>
	pushUrl?: boolean | string
	autoDisable?: boolean
	ariaBusy?: boolean
	state?: { value: boolean }
}
declare function __aeroSignal(name: string): { value: boolean }
declare function GET(url: string, options?: HypermediaActionOptions): Promise<HypermediaResponse>
declare function POST(url: string, options?: HypermediaActionOptions): Promise<HypermediaResponse>
declare function PUT(url: string, options?: HypermediaActionOptions): Promise<HypermediaResponse>
declare function PATCH(url: string, options?: HypermediaActionOptions): Promise<HypermediaResponse>
declare function DELETE(url: string, options?: HypermediaActionOptions): Promise<HypermediaResponse>
`

/** Virtual TS prelude for `on:*` handler bodies — matches runtime mount `compileHandler` scope. */
export const EVENT_HANDLER_SCOPE_DECL =
	HYPERMEDIA_ACTION_SCOPE_DECL + 'declare const event: Event;\n'

type AttributeMask = { start: number; length: number }
type AttributeInterpolation = {
	expression: string
	sourceOffset: number
	wrapPropsObjectLiteral?: boolean
	isEventHandler?: boolean
}

function maskScriptAndStyleInner(sourceText: string): string {
	return sourceText.replace(
		/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi,
		(match, _tag: string, inner: string) => match.replace(inner, ' '.repeat(inner.length))
	)
}

function maskForDirectiveValues(sourceText: string): string {
	return sourceText.replace(
		/\b(?:aero-|data-aero-)?for\s*=\s*(['"])([\s\S]*?)\1/gi,
		(match, _q: string, inner: string) => match.replace(inner, ' '.repeat(inner.length))
	)
}

function isPropsLikeAttribute(name: string): boolean {
	return PROPS_ATTR_NAMES.has(name.toLowerCase())
}

function collectAttributeInterpolations(
	roots: Node[],
	sourceText: string
): {
	interpolations: AttributeInterpolation[]
	masks: AttributeMask[]
} {
	const interpolations: AttributeInterpolation[] = []
	const masks: AttributeMask[] = []

	const attrRegex = /(?:\s|^)([a-zA-Z0-9\-:@.]+)(?:(\s*=\s*)(['"])([\s\S]*?)\3)?/gi

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

		attrRegex.lastIndex = 0
		let attrMatch: RegExpExecArray | null

		while ((attrMatch = attrRegex.exec(attrsContent)) !== null) {
			const fullMatch = attrMatch[0]
			const name = attrMatch[1]
			const hasValue = !!attrMatch[3]
			const value = attrMatch[4] || ''

			if (!hasValue || !value) continue

			const matchStartInAttrs = attrMatch.index
			const nameStartInMatch = fullMatch.indexOf(name)
			const quote = attrMatch[3]
			const quoteIndex = fullMatch.indexOf(quote, nameStartInMatch + name.length)
			const absValueStart = attrsStart + matchStartInAttrs + quoteIndex + 1

			const runtimeDirective = normalizeRuntimeDirectiveName(name)
			if (isDirectiveAttr(name) && runtimeDirective?.family !== 'event') {
				masks.push({ start: absValueStart, length: value.length })
				continue
			}

			if (FOR_ATTR_NAMES.has(name)) continue

			const wrapPropsObjectLiteral = isPropsLikeAttribute(name)
			const isEventHandler = runtimeDirective?.family === 'event'

			masks.push({ start: absValueStart, length: value.length })

			const segments = tokenizeCurlyInterpolation(value, { attributeMode: true })
			for (const seg of segments) {
				if (seg.kind !== 'interpolation') continue
				const expr = seg.expression
				if (!expr.trim()) continue
				interpolations.push({
					expression: expr,
					sourceOffset: absValueStart + seg.start + 1,
					wrapPropsObjectLiteral,
					isEventHandler,
				})
			}
		}
	}

	return { interpolations, masks }
}

function applyMasks(text: string, masks: AttributeMask[]): string {
	let result = text
	for (const mask of masks) {
		result =
			result.substring(0, mask.start) +
			' '.repeat(mask.length) +
			result.substring(mask.start + mask.length)
	}
	return result
}

type ForDirectiveScope = {
	startOffset: number
	endOffset: number
	bindingNames: string[]
}

function normalizeForDirectiveValue(rawValue: string): string {
	let value = rawValue
	if (
		value.length >= 2 &&
		((value[0] === '"' && value[value.length - 1] === '"') ||
			(value[0] === "'" && value[value.length - 1] === "'"))
	) {
		value = value.slice(1, -1)
	}
	const braceMatch = /^\s*\{([\s\S]*)\}\s*$/.exec(value)
	return (braceMatch ? braceMatch[1] : value).trim()
}

function collectForDirectiveScopes(roots: Node[]): ForDirectiveScope[] {
	const scopes: ForDirectiveScope[] = []

	for (const node of walkHtmlNodes(roots)) {
		const attrs = node.attributes
		if (!attrs) continue

		let rawValue: string | undefined
		for (const name of buildDirectiveAttributeNames(ATTR_FOR)) {
			if (attrs[name] != null) {
				rawValue = attrs[name]
				break
			}
		}
		if (rawValue == null) continue

		const inner = normalizeForDirectiveValue(rawValue)
		if (!inner) continue

		let bindingNames: string[]
		try {
			bindingNames = [...collectForDirectiveBindingNames(inner), ...FOR_LOOP_IMPLICIT_NAMES]
		} catch {
			continue
		}

		if (bindingNames.length === 0) continue

		// Bindings apply to sibling attributes on the same tag, not only to content after `>`.
		const startOffset = node.start
		const endOffset = node.endTagStart ?? node.end
		scopes.push({ startOffset, endOffset, bindingNames })
	}

	return scopes
}

function getForBindingsAtOffset(offset: number, scopes: ForDirectiveScope[]): Set<string> {
	const names = new Set<string>()
	for (const scope of scopes) {
		if (offset >= scope.startOffset && offset < scope.endOffset) {
			for (const name of scope.bindingNames) {
				names.add(name)
			}
		}
	}
	return names
}

/**
 * Ambient prelude for a `{ }` expression at `braceOffset`, matching the language server virtual TS block.
 */
export function formatInterpolationBinderPrelude(
	sourceText: string,
	braceOffset: number,
	buildBindingNames: ReadonlySet<string>,
	buildTypeDeclTexts: readonly string[],
	buildScriptBodies: readonly string[],
	stateScriptBodies: readonly string[] = [],
	options?: { writableNames?: ReadonlySet<string> }
): string {
	const doc = parseMinimalHtmlFromText(
		escapeInterpolationBodyMarkup(maskScriptAndStyleInner(sourceText)).text
	)
	const scopes = collectForDirectiveScopes(doc.roots)
	const forBindings = getForBindingsAtOffset(braceOffset, scopes)
	const allBindings =
		forBindings.size > 0 ? new Set([...buildBindingNames, ...forBindings]) : buildBindingNames
	const writableNames =
		options?.writableNames && options.writableNames.size > 0
			? new Set([...options.writableNames].filter(name => allBindings.has(name)))
			: undefined
	return formatBuildScopeAmbientPrelude(
		allBindings,
		buildTypeDeclTexts,
		[...buildScriptBodies, ...stateScriptBodies],
		writableNames
	)
}

/**
 * Convenience: {@link buildTemplateEditorAmbient} + {@link formatInterpolationBinderPrelude}.
 */
export function formatInterpolationBinderPreludeFromTemplate(
	sourceText: string,
	braceOffset: number,
	options?: { writableNames?: ReadonlySet<string> }
): string {
	const ambient = buildTemplateEditorAmbient(sourceText)
	return formatInterpolationBinderPrelude(
		sourceText,
		braceOffset,
		ambient.bindingNames,
		ambient.typeDeclarationTexts,
		ambient.buildScriptBodies,
		ambient.stateScriptBodies,
		options
	)
}

/** Build virtual TS for a template interpolation/event site (language server + type-check). */
export function buildTemplateInterpolationVirtualText(
	sourceText: string,
	site: TemplateInterpolationSite,
	preamble: string
): { virtualText: string; expressionOffsetInVirtual: number } {
	const ambient = buildTemplateEditorAmbient(sourceText)
	const binderDecl = formatInterpolationBinderPreludeFromTemplate(sourceText, site.braceOffset, {
		writableNames: site.isEventHandler
			? new Set([...ambient.writableStateBindingNames, ...ambient.readonlyReactivePropNames])
			: undefined,
	})
	const head = preamble + binderDecl

	if (site.isEventHandler) {
		const handlerExpr = rewriteHypermediaActionStateRefs(
			site.expression,
			ambient.ownedStateBindingNames
		)
		const virtualText =
			head +
			EVENT_HANDLER_SCOPE_DECL +
			handlerExpr +
			(handlerExpr.trimEnd().endsWith(';') ? '' : ';')
		return {
			virtualText,
			expressionOffsetInVirtual: head.length + EVENT_HANDLER_SCOPE_DECL.length,
		}
	}

	const open = site.wrapPropsObjectLiteral === true ? '[{' : '['
	const close = site.wrapPropsObjectLiteral === true ? '}]' : ']'
	const virtualText = head + open + site.expression + close
	return { virtualText, expressionOffsetInVirtual: head.length + open.length }
}

/**
 * All `{ ... }` interpolation expressions in document order (attribute interpolations first, then text).
 */
export function collectTemplateInterpolationSites(sourceText: string): TemplateInterpolationSite[] {
	const doc = parseMinimalHtmlFromText(
		escapeInterpolationBodyMarkup(maskScriptAndStyleInner(sourceText)).text
	)
	const roots = doc.roots
	const out: TemplateInterpolationSite[] = []

	const { interpolations, masks } = collectAttributeInterpolations(roots, sourceText)
	for (const i of interpolations) {
		out.push({
			expression: i.expression,
			braceOffset: i.sourceOffset,
			...(i.wrapPropsObjectLiteral ? { wrapPropsObjectLiteral: true as const } : {}),
			...(i.isEventHandler ? { isEventHandler: true as const } : {}),
		})
	}

	const masked = applyMasks(maskForDirectiveValues(maskScriptAndStyleInner(sourceText)), masks)
	for (const seg of tokenizeCurlyInterpolation(masked)) {
		if (seg.kind !== 'interpolation') continue
		const expr = seg.expression
		if (!expr.trim()) continue
		out.push({ expression: expr, braceOffset: seg.start + 1 })
	}

	return out
}
