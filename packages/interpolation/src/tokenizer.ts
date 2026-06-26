/**
 * Shared tokenizer for `{ }` interpolation. Tracks brace depth and string/comment
 * context so nested braces and content inside strings/comments are handled correctly.
 *
 * @remarks
 * Used by @aero-js/core (compileInterpolation, compileAttributeInterpolation) and
 * can be used by aero-vscode for consistent interpolation semantics.
 */

export type LiteralSegment = {
	kind: 'literal'
	start: number
	end: number
	value: string
}

export type InterpolationSegment = {
	kind: 'interpolation'
	start: number
	end: number
	expression: string
}

export type Segment = LiteralSegment | InterpolationSegment

export interface TokenizeOptions {
	/** When true, `{{` and `}}` emit literal `{` and `}`; otherwise they are two braces. */
	attributeMode?: boolean
}

function escapeTemplateLiteralContent(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

/**
 * Tokenize a string into literal and interpolation segments. Tracks nesting and
 * string/comment context so expressions like `{ a({ b: 1 }) }` or `{ "}" }` are
 * one interpolation.
 *
 * @param text - Input string (e.g. attribute value or text content).
 * @param options - `attributeMode: true` for attribute values ({{ / }} = literal braces).
 * @returns Array of segments in order.
 */
export function tokenizeCurlyInterpolation(text: string, options: TokenizeOptions = {}): Segment[] {
	const attributeMode = options.attributeMode ?? false
	const segments: Segment[] = []
	let i = 0
	let depth = 0
	let literalStart = 0
	let interpOpenIndex = -1
	let interpExprStart = -1
	let inString: null | '"' | "'" | '`' = null
	let inComment: null | '//' | '/*' = null

	function pushLiteral(from: number, to: number) {
		if (from < to) {
			segments.push({
				kind: 'literal',
				start: from,
				end: to,
				value: text.slice(from, to),
			})
		}
	}

	function pushInterpolation(openIndex: number, closeIndex: number) {
		segments.push({
			kind: 'interpolation',
			start: openIndex,
			end: closeIndex + 1,
			expression: text.slice(openIndex + 1, closeIndex),
		})
	}

	while (i < text.length) {
		const char = text[i]
		const next = text[i + 1]

		if (inComment) {
			if (inComment === '//' && char === '\n') {
				inComment = null
			} else if (inComment === '/*' && char === '*' && next === '/') {
				inComment = null
				i++
			}
			i++
			continue
		}

		if (inString) {
			if (char === '\\') {
				i++
			} else if (char === inString) {
				inString = null
			}
			i++
			continue
		}

		if (attributeMode && depth === 0) {
			if (char === '{' && next === '{') {
				pushLiteral(literalStart, i)
				segments.push({ kind: 'literal', start: i, end: i + 2, value: '{' })
				literalStart = i + 2
				i += 2
				continue
			}
			if (char === '}' && next === '}') {
				pushLiteral(literalStart, i)
				segments.push({ kind: 'literal', start: i, end: i + 2, value: '}' })
				literalStart = i + 2
				i += 2
				continue
			}
		}

		if (char === '/' && next === '/' && depth > 0) {
			inComment = '//'
			i += 2
			continue
		}
		if (char === '/' && next === '*' && depth > 0) {
			inComment = '/*'
			i += 2
			continue
		}
		if (depth > 0 && (char === '"' || char === "'" || char === '`')) {
			inString = char
			i++
			continue
		}

		if (char === '{') {
			if (depth === 0) {
				pushLiteral(literalStart, i)
				interpOpenIndex = i
				interpExprStart = i + 1
			}
			depth++
			i++
			continue
		}

		if (char === '}') {
			depth--
			if (depth === 0) {
				pushInterpolation(interpOpenIndex, i)
				literalStart = i + 1
			}
			i++
			continue
		}

		i++
	}

	if (depth > 0) {
		segments.push({
			kind: 'interpolation',
			start: interpOpenIndex,
			end: text.length,
			expression: text.slice(interpExprStart, text.length),
		})
		literalStart = text.length
	}

	pushLiteral(literalStart, text.length)
	return segments
}

export type ByteRange = { readonly start: number; readonly end: number }

/** Ranges of Aero `{ ... }` expression interiors (exclusive of the brace characters). */
export function collectInterpolationBodyRanges(
	text: string,
	options: TokenizeOptions = {}
): ByteRange[] {
	const ranges: ByteRange[] = []
	for (const seg of tokenizeCurlyInterpolation(text, options)) {
		if (seg.kind === 'interpolation') {
			ranges.push({ start: seg.start + 1, end: seg.end - 1 })
		}
	}
	return ranges
}

export function isOffsetInRanges(offset: number, ranges: readonly ByteRange[]): boolean {
	for (const range of ranges) {
		if (offset >= range.start && offset < range.end) return true
	}
	return false
}

/** Mask Aero `{ ... }` expression bodies so markup-like text inside is not parsed as HTML. */
export function maskInterpolationExpressionBodies(
	text: string,
	options: TokenizeOptions = {}
): string {
	const chars = [...text]
	for (const seg of tokenizeCurlyInterpolation(text, options)) {
		if (seg.kind !== 'interpolation') continue
		for (let i = seg.start + 1; i < seg.end - 1; i++) {
			chars[i] = ' '
		}
	}
	return chars.join('')
}

/**
 * Build a template-literal-safe string from segments: escape backticks in literal
 * segments and emit `${expression}` for interpolations.
 */
export function compileInterpolationFromSegments(segments: Segment[]): string {
	return segments
		.map(seg => {
			if (seg.kind === 'literal') {
				return escapeTemplateLiteralContent(seg.value)
			}
			return `\${${seg.expression}}`
		})
		.join('')
}
