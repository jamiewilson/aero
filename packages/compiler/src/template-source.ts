/**
 * Offset-preserving view of live Aero template source.
 *
 * @remarks
 * HTML comments are inactive template source. This module keeps that rule in one
 * place for compiler-adjacent tooling without changing compiler code generation.
 */

/** A half-open source range. */
export type TemplateSourceRange = { readonly start: number; readonly end: number }

/** The executable role of an HTML script tag. */
export type TemplateScriptKind =
	| 'build'
	| 'state'
	| 'inline'
	| 'blocking'
	| 'bundled'
	| 'external'

/** A live script tag and its original source offsets. */
export interface TemplateScriptBlock {
	readonly kind: TemplateScriptKind
	readonly attrs: string
	readonly content: string
	readonly contentStart: number
	readonly tagStart: number
	readonly tagLength: number
}

/** Parsed live source shared by editor-facing Aero tooling. */
export interface TemplateSourceAnalysis {
	readonly commentRanges: readonly TemplateSourceRange[]
	readonly maskedText: string
	readonly scriptBlocks: readonly TemplateScriptBlock[]
}

function isScriptTagBoundary(char: string | undefined): boolean {
	return char === undefined || /[\t\n\f\r />]/.test(char)
}

function findTagEnd(text: string, start: number): number {
	let quote: '"' | "'" | null = null
	for (let i = start; i < text.length; i++) {
		const char = text[i]
		if (quote) {
			if (char === quote) quote = null
			continue
		}
		if (char === '"' || char === "'") {
			quote = char
			continue
		}
		if (char === '>') return i
	}
	return -1
}

function findClosingTag(text: string, lowerText: string, name: string, from: number): number {
	const needle = `</${name}`
	let cursor = from
	while (cursor < text.length) {
		const closeStart = lowerText.indexOf(needle, cursor)
		if (closeStart === -1) return -1
		if (isScriptTagBoundary(text[closeStart + needle.length])) return closeStart
		cursor = closeStart + 1
	}
	return -1
}

/** Collect HTML comments while leaving raw script/style contents untouched. */
export function collectHtmlCommentRanges(text: string): TemplateSourceRange[] {
	const ranges: TemplateSourceRange[] = []
	const lowerText = text.toLowerCase()
	let cursor = 0

	while (cursor < text.length) {
		const commentStart = text.indexOf('<!--', cursor)
		const scriptStart = lowerText.indexOf('<script', cursor)
		const styleStart = lowerText.indexOf('<style', cursor)
		const rawStart = [scriptStart, styleStart]
			.filter(start => start >= 0)
			.reduce<number | undefined>((nearest, start) =>
				nearest === undefined || start < nearest ? start : nearest, undefined)

		if (commentStart === -1 && rawStart === undefined) break
		if (commentStart !== -1 && (rawStart === undefined || commentStart < rawStart)) {
			const endMarker = text.indexOf('-->', commentStart + 4)
			const end = endMarker === -1 ? text.length : endMarker + 3
			ranges.push({ start: commentStart, end })
			cursor = end
			continue
		}

		const name = rawStart === scriptStart ? 'script' : 'style'
		if (!isScriptTagBoundary(text[rawStart! + name.length + 1])) {
			cursor = rawStart! + 1
			continue
		}
		const openEnd = findTagEnd(text, rawStart! + name.length + 1)
		if (openEnd === -1) break
		const closeStart = findClosingTag(text, lowerText, name, openEnd + 1)
		if (closeStart === -1) break
		const closeEnd = findTagEnd(text, closeStart + name.length + 2)
		cursor = closeEnd === -1 ? text.length : closeEnd + 1
	}

	return ranges
}

/** Replace HTML comment characters with spaces while retaining every source offset. */
export function maskHtmlComments(text: string, ranges = collectHtmlCommentRanges(text)): string {
	let masked = text
	for (const range of ranges) {
		masked = masked.slice(0, range.start) + ' '.repeat(range.end - range.start) + masked.slice(range.end)
	}
	return masked
}

/** Classify a script tag from its raw attributes. */
export function classifyTemplateScriptTag(attrs: string): TemplateScriptKind {
	const lower = attrs.toLowerCase()
	if (/\bsrc\s*=/.test(lower)) return 'external'
	if (/\bis:build\b/.test(lower)) return 'build'
	if (/\bis:state\b/.test(lower)) return 'state'
	if (/\bis:inline\b/.test(lower)) return 'inline'
	if (/\bis:blocking\b/.test(lower)) return 'blocking'
	return 'bundled'
}

/** Parse executable script tags that are not contained in HTML comments. */
export function collectTemplateScriptBlocks(source: string): TemplateScriptBlock[] {
	const blocks: TemplateScriptBlock[] = []
	const text = maskHtmlComments(source)
	const lowerText = text.toLowerCase()
	let cursor = 0

	while (cursor < text.length) {
		const tagStart = lowerText.indexOf('<script', cursor)
		if (tagStart === -1) break
		if (!isScriptTagBoundary(text[tagStart + '<script'.length])) {
			cursor = tagStart + 1
			continue
		}
		const openingTagEnd = findTagEnd(text, tagStart + '<script'.length)
		if (openingTagEnd === -1) break
		const closeStart = findClosingTag(text, lowerText, 'script', openingTagEnd + 1)
		if (closeStart === -1) break
		const closeTagEnd = findTagEnd(text, closeStart + '</script'.length)
		if (closeTagEnd === -1) break

		const attrs = source.slice(tagStart + '<script'.length, openingTagEnd)
		const contentStart = openingTagEnd + 1
		blocks.push({
			kind: classifyTemplateScriptTag(attrs),
			attrs,
			content: source.slice(contentStart, closeStart),
			contentStart,
			tagStart,
			tagLength: closeTagEnd + 1 - tagStart,
		})
		cursor = closeTagEnd + 1
	}

	return blocks
}

/** Analyze live template source once for all editor-facing consumers. */
export function analyzeTemplateSource(source: string): TemplateSourceAnalysis {
	const commentRanges = collectHtmlCommentRanges(source)
	const maskedText = maskHtmlComments(source, commentRanges)
	return {
		commentRanges,
		maskedText,
		scriptBlocks: collectTemplateScriptBlocks(source),
	}
}
