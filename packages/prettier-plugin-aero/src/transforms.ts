import type { Node } from '@aero-js/html-parser'
import { parseMinimalHtmlFromText, walkHtmlNodes } from '@aero-js/html-parser'
import { tokenizeCurlyInterpolation } from '@aero-js/interpolation'
import prettier from 'prettier'
import {
	BUILD_DIRECTIVES,
	canonicalBuildDirectiveName,
	isBuildDirectiveAttribute,
	isNativeBareAttribute,
	normalizeAttributeValue,
} from '@aero-js/compiler/build-directive-attributes'
import {
	formatDirectiveName,
	isSelfClosingComponentTag,
	quoteAttributeValue,
} from './directives.js'
import type { AeroPluginOptions } from './options.js'

type TextEdit = { start: number; end: number; text: string }

function collectAttributeEdits(source: string, nodes: Node[], usePrefix: boolean): TextEdit[] {
	const edits: TextEdit[] = []
	for (const node of walkHtmlNodes(nodes)) {
		if (!node.attributes || !node.tag) continue
		const tagStart = node.start
		if (tagStart == null) continue

		for (const [name, rawValue] of Object.entries(node.attributes)) {
			const effectiveValue = rawValue ?? '""'
			// Leave native HTML attributes (e.g. `default` on <track>) untouched; renaming them to a
			// `data-` form would change their meaning.
			if (isNativeBareAttribute(node.tag, name, effectiveValue)) continue
			if (!isBuildDirectiveAttribute(name, effectiveValue)) continue
			const canonical = canonicalBuildDirectiveName(name)
			const desired = formatDirectiveName(canonical, usePrefix)
			if (name === desired) continue

			const nameStart = findAttributeNameStart(source, tagStart, name)
			if (nameStart == null) continue
			edits.push({ start: nameStart, end: nameStart + name.length, text: desired })
		}
	}
	return edits
}

function findAttributeNameStart(source: string, tagStart: number, name: string): number | null {
	const tagSlice = source.slice(tagStart)
	const patterns = [
		new RegExp(`\\s${name}\\s*=`, 'i'),
		new RegExp(`\\s${name}(\\s|>|/>)`, 'i'),
		new RegExp(`^<[^>]*?\\s${name}\\s*=`, 'i'),
	]
	for (const pattern of patterns) {
		const match = tagSlice.match(pattern)
		if (match?.index != null) {
			const offset = match[0].search(new RegExp(name, 'i'))
			if (offset >= 0) return tagStart + match.index + offset
		}
	}
	const idx = tagSlice.indexOf(name)
	if (idx >= 0) {
		const before = tagSlice[idx - 1]
		const after = tagSlice[idx + name.length]
		if ((before === ' ' || before === '\n' || before === '\t' || idx === 0) && after !== '-') {
			return tagStart + idx
		}
	}
	return null
}

function formatBracedWrapper(inner: string, spaced: boolean): string {
	const trimmed = inner.trim()
	if (!trimmed) return spaced ? '{ }' : '{}'
	return spaced ? `{ ${trimmed} }` : `{${trimmed}}`
}

function isSingleBracedExpression(text: string): boolean {
	const trimmed = text.trim()
	const segments = tokenizeCurlyInterpolation(trimmed, { attributeMode: true })
	return (
		segments.length === 1 &&
		segments[0].kind === 'interpolation' &&
		segments[0].start === 0 &&
		segments[0].end === trimmed.length
	)
}

async function formatExpressionContents(
	expression: string,
	options: prettier.Options
): Promise<string> {
	const trimmed = expression.trim()
	const formatOptions: prettier.Options = {
		...options,
		parser: 'babel-ts',
		semi: options.semi ?? false,
	}

	const stripFormatted = (value: string): string => value.trim().replace(/;\s*$/, '')

	try {
		return stripFormatted(await prettier.format(trimmed, formatOptions))
	} catch {
		try {
			const wrapped = await prettier.format(`(${trimmed})`, formatOptions)
			return stripFormatted(
				wrapped
					.trim()
					.replace(/^\(/, '')
					.replace(/\)\;?\s*$/, '')
			)
		} catch {
			return trimmed
		}
	}
}

async function formatBracedRegion(
	source: string,
	start: number,
	end: number,
	spaced: boolean,
	options: prettier.Options,
	formatInner: boolean
): Promise<TextEdit | null> {
	const raw = source.slice(start, end)
	if (!isSingleBracedExpression(raw)) return null
	const inner = raw.trim().slice(1, -1)
	const formattedInner = formatInner ? await formatExpressionContents(inner, options) : inner.trim()
	const next = formatBracedWrapper(formattedInner, spaced)
	if (next === raw) return null
	return { start, end, text: next }
}

async function collectBracketSpacingEdits(
	source: string,
	nodes: Node[],
	spaced: boolean,
	options: prettier.Options
): Promise<TextEdit[]> {
	const edits: TextEdit[] = []

	for (const node of walkHtmlNodes(nodes)) {
		if (node.tag === 'script' || node.tag === 'style') continue

		if (node.attributes) {
			for (const [name, rawValue] of Object.entries(node.attributes)) {
				if (rawValue == null) continue
				const value = normalizeAttributeValue(rawValue)
				const valueStart = findAttributeValueContentStart(
					source,
					node.start ?? 0,
					name,
					rawValue
				)
				if (valueStart == null) continue
				const segments = tokenizeCurlyInterpolation(value, { attributeMode: true })
				for (const seg of segments) {
					if (seg.kind !== 'interpolation') continue
					const edit = await formatBracedRegion(
						source,
						valueStart + seg.start,
						valueStart + seg.end,
						spaced,
						options,
						true
					)
					if (edit) edits.push(edit)
				}
			}
		}

		const innerStart = node.startTagEnd
		const innerEnd = node.endTagStart
		const hasElementChildren = node.children?.some(child => Boolean(child.tag)) ?? false
		if (hasElementChildren) continue
		if (innerStart != null && innerEnd != null && innerEnd > innerStart) {
			const text = source.slice(innerStart, innerEnd)
			const segments = tokenizeCurlyInterpolation(text, { attributeMode: false })
			for (const seg of segments) {
				if (seg.kind !== 'interpolation') continue
				const edit = await formatBracedRegion(
					source,
					innerStart + seg.start,
					innerStart + seg.end,
					spaced,
					options,
					true
				)
				if (edit) edits.push(edit)
			}
		}
	}

	return edits
}

function findAttributeValueStart(
	source: string,
	tagStart: number,
	name: string,
	rawValue: string
): number | null {
	const tagSlice = source.slice(tagStart)
	const unquoted = normalizeAttributeValue(rawValue)
	const search = unquoted.startsWith('{')
		? unquoted
		: rawValue.startsWith('"') || rawValue.startsWith("'")
			? rawValue
			: `"${unquoted}"`
	const idx = tagSlice.indexOf(search)
	if (idx < 0) return null
	const eq = tagSlice.indexOf('=', tagSlice.indexOf(name))
	if (eq < 0 || eq > idx) return null
	return tagStart + idx
}

/** Start index of unwrapped attribute value content within source. */
function findAttributeValueContentStart(
	source: string,
	tagStart: number,
	name: string,
	rawValue: string
): number | null {
	const valueStart = findAttributeValueStart(source, tagStart, name, rawValue)
	if (valueStart == null) return null
	const quote = source[valueStart]
	if (quote === '"' || quote === "'") return valueStart + 1
	return valueStart
}

function collectSelfClosingEdits(
	source: string,
	nodes: Node[],
	selfClosing: boolean
): TextEdit[] {
	const edits: TextEdit[] = []
	for (const node of walkHtmlNodes(nodes)) {
		if (!node.tag || !isSelfClosingComponentTag(node.tag)) continue
		const hasElementChildren = node.children?.some(child => Boolean(child.tag)) ?? false
		if (hasElementChildren) continue

		const start = node.start
		const end = node.end
		if (start == null || end == null) continue
		const original = source.slice(start, end)

		if (selfClosing) {
			if (/\/>\s*$/.test(original)) continue
			const openMatch = original.match(/^<([^\s/>]+)([^>]*)>\s*<\/\1>\s*$/s)
			if (!openMatch) continue
			const [, tag, attrs = ''] = openMatch
			edits.push({ start, end, text: `<${tag}${attrs} />` })
			continue
		}

		const selfMatch = original.match(/^<([^\s/>]+)([^>]*)\/\>\s*$/s)
		if (!selfMatch) continue
		const [, tag, attrs = ''] = selfMatch
		const trimmedAttrs = attrs.replace(/\s+$/, '')
		edits.push({ start, end, text: `<${tag}${trimmedAttrs}></${tag}>` })
	}
	return edits
}

function dedupeEdits(edits: TextEdit[]): TextEdit[] {
	const seen = new Set<string>()
	const unique: TextEdit[] = []
	for (const edit of edits) {
		const key = `${edit.start}:${edit.end}:${edit.text}`
		if (seen.has(key)) continue
		seen.add(key)
		unique.push(edit)
	}
	return unique
}

function applyEdits(source: string, edits: TextEdit[]): string {
	if (edits.length === 0) return source
	const sorted = dedupeEdits(edits).sort((a, b) => b.start - a.start)
	let result = source
	for (const edit of sorted) {
		result = result.slice(0, edit.start) + edit.text + result.slice(edit.end)
	}
	return result
}

function parseRoots(source: string): Node[] {
	return parseMinimalHtmlFromText(source).roots
}

function getScriptOpenTag(source: string, node: Node): string | null {
	if (node.startTagEnd == null) return null
	const tagStart = source.lastIndexOf('<script', node.startTagEnd)
	if (tagStart === -1) return null
	return source.substring(tagStart, node.startTagEnd)
}

function isBuildScript(node: Node): boolean {
	return node.tag === 'script' && node.attributes != null && 'is:build' in node.attributes
}

/** True if script has lang="ts" or lang="typescript". */
function hasLangTs(node: Node, source: string): boolean {
	const openTag = getScriptOpenTag(source, node)
	return openTag != null && /\blang\s*=\s*["'](ts|typescript)["']/i.test(openTag)
}

/** True if script opts into JavaScript with lang="js" or lang="javascript". */
function hasLangJs(node: Node, source: string): boolean {
	const openTag = getScriptOpenTag(source, node)
	return openTag != null && /\blang\s*=\s*["'](js|javascript)["']/i.test(openTag)
}

async function formatEmbeddedScriptBody(
	scriptContent: string,
	parser: 'babel-ts' | 'babel',
	options: prettier.Options
): Promise<string> {
	if (!scriptContent.trim()) return scriptContent

	const formatOptions: prettier.Options = {
		...options,
		parser,
		semi: options.semi ?? false,
	}

	try {
		const formatted = await prettier.format(scriptContent.trimEnd(), formatOptions)
		const leadingNewline = scriptContent.startsWith('\n') ? '\n' : ''
		const trailingNewline = scriptContent.endsWith('\n') ? '\n' : ''
		return leadingNewline + formatted.trimEnd() + trailingNewline
	} catch {
		return scriptContent
	}
}

async function collectBuildScriptEdits(
	source: string,
	nodes: Node[],
	options: prettier.Options
): Promise<TextEdit[]> {
	const edits: TextEdit[] = []

	for (const node of walkHtmlNodes(nodes)) {
		if (!isBuildScript(node)) continue
		if (node.startTagEnd == null || node.endTagStart == null) continue
		if (hasLangTs(node, source)) continue

		const scriptContent = source.substring(node.startTagEnd, node.endTagStart)
		if (!scriptContent.trim()) continue

		const parser = hasLangJs(node, source) ? 'babel' : 'babel-ts'
		const formatted = await formatEmbeddedScriptBody(scriptContent, parser, options)
		if (formatted !== scriptContent) {
			edits.push({ start: node.startTagEnd, end: node.endTagStart, text: formatted })
		}
	}

	return edits
}

export async function applyAeroTransforms(
	source: string,
	nodes: Node[],
	options: AeroPluginOptions,
	prettierOptions: prettier.Options = {}
): Promise<string> {
	let result = source
	let currentNodes = nodes

	const prefixEdits = collectAttributeEdits(result, currentNodes, options.aeroAttributePrefix)
	result = applyEdits(result, prefixEdits)
	currentNodes = parseRoots(result)

	const bracketEdits = await collectBracketSpacingEdits(
		result,
		currentNodes,
		options.aeroBracketSpacing,
		prettierOptions
	)
	result = applyEdits(result, bracketEdits)
	currentNodes = parseRoots(result)

	const selfClosingEdits = collectSelfClosingEdits(
		result,
		currentNodes,
		options.aeroSelfClosingComponents
	)
	result = applyEdits(result, selfClosingEdits)
	currentNodes = parseRoots(result)

	const buildScriptEdits = await collectBuildScriptEdits(result, currentNodes, prettierOptions)
	result = applyEdits(result, buildScriptEdits)

	return result
}

export { quoteAttributeValue, BUILD_DIRECTIVES }
