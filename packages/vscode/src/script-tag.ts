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

/** Source pattern for matching `<script>` tags. Use with `new RegExp(SCRIPT_TAG_PATTERN, 'gi')`. */
export const SCRIPT_TAG_PATTERN = '<script\\b([^>]*)>([\\s\\S]*?)<\\/script>'

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
	const regex = new RegExp(SCRIPT_TAG_PATTERN, 'gi')
	let match: RegExpExecArray | null

	while ((match = regex.exec(text)) !== null) {
		const attrs = match[1] || ''
		const content = match[2]
		const tagStart = match.index
		// `content` can be empty (`<script ...></script>`). Using `indexOf(content)`
		// would return 0 for empty strings and incorrectly point `contentStart` at `tagStart`.
		// The regex guarantees `match[0]` contains the full opening tag ending `>` and
		// the content capture group begins immediately after that.
		const openingTagEndInMatch = match[0].indexOf('>') + 1
		const contentStart = tagStart + openingTagEndInMatch

		blocks.push({
			kind: classifyScriptTag(attrs),
			attrs,
			content,
			contentStart,
			tagStart,
			tagLength: match[0].length,
		})
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
export function filterBlocksByKind(blocks: ParsedScriptBlock[], kind: ScriptTagKind): ParsedScriptBlock[] {
	return blocks.filter(b => b.kind === kind)
}
