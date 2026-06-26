import type { Node } from '@aero-js/html-parser'
import { parseMinimalHtmlFromText, walkHtmlNodes } from '@aero-js/html-parser'
import { tokenizeCurlyInterpolation } from '@aero-js/interpolation'
import prettier from 'prettier'
import {
	BUILD_DIRECTIVES,
	canonicalBuildDirectiveNameForFormatting,
	formatBuildDirectiveName,
	isBuildDirectiveAttributeForFormatting,
	isNativeBareAttribute,
	normalizeAttributeValue,
} from '@aero-js/compiler/build-directive-attributes'
import type { BuildDirectivePrefixMode } from '@aero-js/compiler/build-directive-attributes'
import { isSelfClosingComponentTag, quoteAttributeValue } from './directives.js'
import type { AeroExpressionFormatting, AeroPluginOptions } from './options.js'
import { logAeroPrettierTiming } from './dev-timing.js'
import { performance } from 'node:perf_hooks'

type TextEdit = { start: number; end: number; text: string }

type BracedRegionTask = {
	start: number
	end: number
	spaced: boolean
	formatInner: boolean
}

type BuildScriptTask = {
	start: number
	end: number
	content: string
	parser: 'babel-ts' | 'babel'
}

const expressionFormatCache = new Map<string, string>()
const scriptFormatCache = new Map<string, string>()

let parseCountForTests = 0

/** @internal Test helper */
export function resetTransformMetricsForTests(): void {
	parseCountForTests = 0
	expressionFormatCache.clear()
	scriptFormatCache.clear()
}

/** @internal Test helper */
export function getParseCountForTests(): number {
	return parseCountForTests
}

const attributeNamePatterns = new Map<string, RegExp[]>()

function attributeNamePatternsFor(name: string): RegExp[] {
	let patterns = attributeNamePatterns.get(name)
	if (!patterns) {
		patterns = [
			new RegExp(`\\s${name}\\s*=`, 'i'),
			new RegExp(`\\s${name}(\\s|>|/>)`, 'i'),
			new RegExp(`^<[^>]*?\\s${name}\\s*=`, 'i'),
		]
		attributeNamePatterns.set(name, patterns)
	}
	return patterns
}

function expressionFormatCacheKey(
	expression: string,
	options: prettier.Options,
	expressionFormatting: AeroExpressionFormatting
): string {
	return `${expressionFormatting}\0${expression}\0${options.semi ?? false}\0${options.singleQuote}\0${options.trailingComma}`
}

function scriptFormatCacheKey(
	content: string,
	parser: 'babel-ts' | 'babel',
	options: prettier.Options
): string {
	return `${parser}\0${content}\0${options.semi ?? false}\0${options.singleQuote}\0${options.trailingComma}`
}

/** Safe for spacing-only: identifiers, member access, calls with simple args — no statements. */
const TRIVIAL_EXPRESSION_RE =
	/^[\w$?.[\]('"+\-/*%|&!<>=:, \t\n]*$/

function isTrivialExpression(expression: string): boolean {
	const trimmed = expression.trim()
	if (!trimmed) return true
	if (/[;`]|=>|\bimport\b|\bfunction\b|\bconst\b|\blet\b|\bvar\b/.test(trimmed)) {
		return false
	}
	return TRIVIAL_EXPRESSION_RE.test(trimmed)
}

function collectAttributeEdits(
	source: string,
	nodes: Node[],
	prefixMode: BuildDirectivePrefixMode
): TextEdit[] {
	const edits: TextEdit[] = []
	for (const node of walkHtmlNodes(nodes)) {
		if (!node.attributes || !node.tag) continue
		const tagStart = node.start
		if (tagStart == null) continue

		for (const [name, rawValue] of Object.entries(node.attributes)) {
			const effectiveValue = rawValue ?? '""'
			if (isNativeBareAttribute(node.tag, name, effectiveValue)) continue
			if (!isBuildDirectiveAttributeForFormatting(name, effectiveValue)) continue
			const canonical = canonicalBuildDirectiveNameForFormatting(name)
			const desired = formatBuildDirectiveName(canonical, prefixMode)
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
	for (const pattern of attributeNamePatternsFor(name)) {
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

function bracedRegionAlreadyMatches(
	source: string,
	start: number,
	end: number,
	spaced: boolean,
	expressionFormatting: AeroExpressionFormatting
): boolean {
	if (expressionFormatting === 'off') return true
	const raw = source.slice(start, end)
	if (!isSingleBracedExpression(raw)) return true
	const inner = raw.trim().slice(1, -1)
	const expected = formatBracedWrapper(inner.trim(), spaced)
	return raw === expected
}

async function formatExpressionContents(
	expression: string,
	options: prettier.Options,
	expressionFormatting: AeroExpressionFormatting
): Promise<string> {
	const trimmed = expression.trim()
	const cacheKey = expressionFormatCacheKey(trimmed, options, expressionFormatting)
	const cached = expressionFormatCache.get(cacheKey)
	if (cached !== undefined) return cached

	if (expressionFormatting === 'spacing-only' || isTrivialExpression(trimmed)) {
		expressionFormatCache.set(cacheKey, trimmed)
		return trimmed
	}

	const formatOptions: prettier.Options = {
		...options,
		parser: 'babel-ts',
		semi: options.semi ?? false,
	}

	const stripFormatted = (value: string): string =>
		value
			.trim()
			.replace(/^;\s*/, '')
			.replace(/;\s*$/, '')

	try {
		const formatted = stripFormatted(await prettier.format(trimmed, formatOptions))
		expressionFormatCache.set(cacheKey, formatted)
		return formatted
	} catch {
		try {
			const wrapped = await prettier.format(`(${trimmed})`, formatOptions)
			const formatted = stripFormatted(
				wrapped
					.trim()
					.replace(/^\(/, '')
					.replace(/\)\;?\s*$/, '')
			)
			expressionFormatCache.set(cacheKey, formatted)
			return formatted
		} catch {
			expressionFormatCache.set(cacheKey, trimmed)
			return trimmed
		}
	}
}

async function formatBracedRegion(
	source: string,
	task: BracedRegionTask,
	options: prettier.Options,
	expressionFormatting: AeroExpressionFormatting
): Promise<TextEdit | null> {
	if (expressionFormatting === 'off') return null
	const { start, end, spaced, formatInner } = task
	const raw = source.slice(start, end)
	if (!isSingleBracedExpression(raw)) return null
	const inner = raw.trim().slice(1, -1)
	const formattedInner = formatInner
		? await formatExpressionContents(inner, options, expressionFormatting)
		: inner.trim()
	const next = formatBracedWrapper(formattedInner, spaced)
	if (next === raw) return null
	return { start, end, text: next }
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

function collectTransformTasks(
	source: string,
	nodes: Node[],
	options: AeroPluginOptions,
	expressionFormatting: AeroExpressionFormatting
): {
	selfClosingEdits: TextEdit[]
	bracketTasks: BracedRegionTask[]
	buildScriptTasks: BuildScriptTask[]
} {
	const selfClosingEdits = collectSelfClosingEdits(
		source,
		nodes,
		options.aeroSelfClosingComponents
	)
	const bracketTasks: BracedRegionTask[] = []
	const buildScriptTasks: BuildScriptTask[] = []

	if (expressionFormatting !== 'off') {
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
						const start = valueStart + seg.start
						const end = valueStart + seg.end
						if (
							bracedRegionAlreadyMatches(
								source,
								start,
								end,
								options.aeroBracketSpacing,
								expressionFormatting
							)
						) {
							continue
						}
						bracketTasks.push({
							start,
							end,
							spaced: options.aeroBracketSpacing,
							formatInner: true,
						})
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
					const start = innerStart + seg.start
					const end = innerStart + seg.end
					if (
						bracedRegionAlreadyMatches(
							source,
							start,
							end,
							options.aeroBracketSpacing,
							expressionFormatting
						)
					) {
						continue
					}
					bracketTasks.push({
						start,
						end,
						spaced: options.aeroBracketSpacing,
						formatInner: true,
					})
				}
			}
		}
	}

	for (const node of walkHtmlNodes(nodes)) {
		if (!isBuildScript(node)) continue
		if (node.startTagEnd == null || node.endTagStart == null) continue
		if (hasLangTs(node, source)) continue

		const scriptContent = source.substring(node.startTagEnd, node.endTagStart)
		if (!scriptContent.trim()) continue

		const parser = hasLangJs(node, source) ? 'babel' : 'babel-ts'
		buildScriptTasks.push({
			start: node.startTagEnd,
			end: node.endTagStart,
			content: scriptContent,
			parser,
		})
	}

	return { selfClosingEdits, bracketTasks, buildScriptTasks }
}

function isNoOpTransform(
	source: string,
	nodes: Node[],
	options: AeroPluginOptions,
	expressionFormatting: AeroExpressionFormatting
): boolean {
	if (collectAttributeEdits(source, nodes, options.aeroAttributePrefix).length > 0) return false
	const tasks = collectTransformTasks(source, nodes, options, expressionFormatting)
	if (tasks.selfClosingEdits.length > 0) return false
	if (tasks.bracketTasks.length > 0) return false
	if (tasks.buildScriptTasks.some(task => buildScriptLikelyNeedsFormat(task.content))) return false
	return true
}

function buildScriptLikelyNeedsFormat(content: string): boolean {
	if (!content.trim()) return false
	if (/\bconst  +\w/.test(content)) return true
	if (/(?<![=!<>])=(?!=)/.test(content.replace(/===|!==|=>/g, ''))) return true
	return false
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
	parseCountForTests += 1
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

function hasLangTs(node: Node, source: string): boolean {
	const openTag = getScriptOpenTag(source, node)
	return openTag != null && /\blang\s*=\s*["'](ts|typescript)["']/i.test(openTag)
}

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

	const cacheKey = scriptFormatCacheKey(scriptContent, parser, options)
	const cached = scriptFormatCache.get(cacheKey)
	if (cached !== undefined) return cached

	const formatOptions: prettier.Options = {
		...options,
		parser,
		semi: options.semi ?? false,
	}

	try {
		const formatted = await prettier.format(scriptContent.trimEnd(), formatOptions)
		const leadingNewline = scriptContent.startsWith('\n') ? '\n' : ''
		const trailingNewline = scriptContent.endsWith('\n') ? '\n' : ''
		const result = leadingNewline + formatted.trimEnd() + trailingNewline
		scriptFormatCache.set(cacheKey, result)
		return result
	} catch {
		scriptFormatCache.set(cacheKey, scriptContent)
		return scriptContent
	}
}

async function resolvePhaseBEdits(
	source: string,
	nodes: Node[],
	options: AeroPluginOptions,
	prettierOptions: prettier.Options,
	expressionFormatting: AeroExpressionFormatting
): Promise<TextEdit[]> {
	const { selfClosingEdits, bracketTasks, buildScriptTasks } = collectTransformTasks(
		source,
		nodes,
		options,
		expressionFormatting
	)

	const [bracketEdits, buildEdits] = await Promise.all([
		Promise.all(
			bracketTasks.map(task => formatBracedRegion(source, task, prettierOptions, expressionFormatting))
		).then(results => results.filter((edit): edit is TextEdit => edit != null)),
		Promise.all(
			buildScriptTasks.map(async task => {
				const formatted = await formatEmbeddedScriptBody(task.content, task.parser, prettierOptions)
				if (formatted === task.content) return null
				return { start: task.start, end: task.end, text: formatted } satisfies TextEdit
			})
		).then(results => results.filter((edit): edit is TextEdit => edit != null)),
	])

	return [...selfClosingEdits, ...bracketEdits, ...buildEdits]
}

export async function applyAeroTransforms(
	source: string,
	nodes: Node[],
	options: AeroPluginOptions,
	prettierOptions: prettier.Options = {},
	expressionFormatting: AeroExpressionFormatting = 'full'
): Promise<string> {
	const totalStart = performance.now()

	if (isNoOpTransform(source, nodes, options, expressionFormatting)) {
		logAeroPrettierTiming('preprocess-noop', totalStart)
		return source
	}

	const prefixStart = performance.now()
	const prefixEdits = collectAttributeEdits(source, nodes, options.aeroAttributePrefix)
	logAeroPrettierTiming('preprocess-prefix', prefixStart, `${prefixEdits.length} edits`)

	let result = applyEdits(source, prefixEdits)
	let currentNodes = nodes
	if (prefixEdits.length > 0) {
		const reparseStart = performance.now()
		currentNodes = parseRoots(result)
		logAeroPrettierTiming('preprocess-reparse', reparseStart)
	}

	const phaseBStart = performance.now()
	const phaseBEdits = await resolvePhaseBEdits(
		result,
		currentNodes,
		options,
		prettierOptions,
		expressionFormatting
	)
	logAeroPrettierTiming('preprocess-phase-b', phaseBStart, `${phaseBEdits.length} edits`)

	result = applyEdits(result, phaseBEdits)
	logAeroPrettierTiming('preprocess', totalStart)
	return result
}

export { quoteAttributeValue, BUILD_DIRECTIVES }
