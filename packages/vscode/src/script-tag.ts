/**
 * Shared script-tag classification and parsing.
 *
 * @remarks
 * Every consumer that iterates `<script>` tags needs to classify them by kind
 * (build, inline, blocking, bundled, external). This module centralizes that
 * logic so the regex + attribute checks live in one place.
 */

/** The kind of a `<script>` tag in an Aero HTML file. */
export type ScriptTagKind = 'build' | 'inline' | 'blocking' | 'bundled' | 'external'

/** A parsed `<script>` block with its classification and content. */
export interface ParsedScriptBlock {
	/** Classification derived from attributes. */
	kind: ScriptTagKind
	/** Raw attribute string (e.g. `is:build type="module"`). */
	attrs: string
	/** Script body text between opening and closing tags. */
	content: string
	/** Byte offset of `content` within the full document text. */
	contentStart: number
	/** Byte offset of the opening `<script` tag within the full document text. */
	tagStart: number
	/** Full length of the entire `<script ...>...</script>` match. */
	tagLength: number
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

function findClosingScriptTag(text: string, lowerText: string, from: number): number {
	let cursor = from
	while (cursor < text.length) {
		const closeStart = lowerText.indexOf('</script', cursor)
		if (closeStart === -1) return -1
		if (isScriptTagBoundary(text[closeStart + '</script'.length])) {
			return closeStart
		}
		cursor = closeStart + 1
	}
	return -1
}

/**
 * Classify a script tag's kind from its attribute string.
 *
 * @param attrs - The raw attribute string from a `<script>` tag (between `<script` and `>`).
 * @returns The script tag kind.
 */
export function classifyScriptTag(attrs: string): ScriptTagKind {
	const lower = attrs.toLowerCase()
	if (/\bsrc\s*=/.test(lower)) return 'external'
	if (/\bis:build\b/.test(lower)) return 'build'
	if (/\bis:inline\b/.test(lower)) return 'inline'
	if (/\bis:blocking\b/.test(lower)) return 'blocking'
	return 'bundled'
}

/**
 * Parse all `<script>` blocks from document text into classified blocks.
 *
 * @param text - Full document text.
 * @returns Array of parsed script blocks in document order.
 */
export function parseScriptBlocks(text: string): ParsedScriptBlock[] {
	const blocks: ParsedScriptBlock[] = []
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

		const closeStart = findClosingScriptTag(text, lowerText, openingTagEnd + 1)
		if (closeStart === -1) break

		const closeTagEnd = findTagEnd(text, closeStart + '</script'.length)
		if (closeTagEnd === -1) break

		const attrs = text.slice(tagStart + '<script'.length, openingTagEnd)
		const contentStart = openingTagEnd + 1
		const content = text.slice(contentStart, closeStart)

		blocks.push({
			kind: classifyScriptTag(attrs),
			attrs,
			content,
			contentStart,
			tagStart,
			tagLength: closeTagEnd + 1 - tagStart,
		})

		cursor = closeTagEnd + 1
	}

	return blocks
}

/**
 * Filter parsed script blocks to only those matching a given kind.
 *
 * @param blocks - All parsed script blocks.
 * @param kind - The kind to filter for.
 * @returns Blocks matching the given kind.
 */
export function filterBlocksByKind(
	blocks: ParsedScriptBlock[],
	kind: ScriptTagKind
): ParsedScriptBlock[] {
	return blocks.filter(b => b.kind === kind)
}
