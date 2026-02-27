/**
 * Shared tokenizer for `{ }` interpolation. Tracks brace depth and string/comment
 * context so nested braces and content inside strings/comments are handled correctly.
 *
 * @remarks
 * Used by @aerobuilt/core (compileInterpolation, compileAttributeInterpolation) and
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

/**
 * Tokenize a string into literal and interpolation segments. Tracks nesting and
 * string/comment context so expressions like `{ a({ b: 1 }) }` or `{ "}" }` are
 * one interpolation.
 *
 * @param text - Input string (e.g. attribute value or text content).
 * @param options - `attributeMode: true` for attribute values ({{ / }} = literal braces).
 * @returns Array of segments in order.
 */
export function tokenizeCurlyInterpolation(
	text: string,
	options: TokenizeOptions = {},
): Segment[] {
	const attributeMode = options.attributeMode ?? false
	const segments: Segment[] = []
	let i = 0
	let depth = 0
	let literalStart = 0
	/** Index of opening `{` for the current interpolation (for segment start/end span). */
	let interpOpenIndex = -1
	/** Start of expression (index after `{`) for slice. */
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
		// Segment spans the whole { ... } inclusive; end is exclusive (past the `}`).
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
				i++ // skip /
			}
			i++
			continue
		}

		if (inString) {
			if (char === '\\') {
				i++ // skip escaped char
			} else if (char === inString) {
				inString = null
			}
			i++
			continue
		}

		// Attribute mode: {{ → literal {, }} → literal }
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

		if (char === '/' && next === '/') {
			inComment = '//'
			i += 2
			continue
		}
		if (char === '/' && next === '*') {
			inComment = '/*'
			i += 2
			continue
		}
		if (char === '"' || char === "'" || char === '`') {
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

	// Unclosed interpolation at EOF: treat remainder as one interpolation expression
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

/**
 * Build a template-literal-safe string from segments: escape backticks in literal
 * segments and emit `${expression}` for interpolations.
 *
 * @param segments - Output from tokenizeCurlyInterpolation.
 * @returns String safe to embed inside a template literal (backticks).
 */
export function compileInterpolationFromSegments(segments: Segment[]): string {
	return segments
		.map(seg => {
			if (seg.kind === 'literal') {
				return seg.value.replace(/`/g, '\\`')
			}
			return `\${${seg.expression}}`
		})
		.join('')
}
