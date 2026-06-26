import {
	collectInterpolationBodyRanges,
	escapeInterpolationBodyMarkup,
	isOffsetInRanges,
	maskInterpolationExpressionBodies,
	restoreInterpolationBodyMarkup,
} from '@aero-js/interpolation'

export {
	collectInterpolationBodyRanges,
	escapeInterpolationBodyMarkup,
	isOffsetInRanges,
	maskInterpolationExpressionBodies,
	restoreInterpolationBodyMarkup,
}

/** Replace JS comments with spaces to preserve character indices for range calculations. */
export function maskJsComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, match => ' '.repeat(match.length))
}

/** Mask template literal static spans; keep `${...}` expressions for identifier analysis. */
export function maskTemplateLiteralStatic(text: string): string {
	let result = ''
	let i = 0
	while (i < text.length) {
		if (text[i] !== '`') {
			result += text[i]
			i++
			continue
		}

		result += '`'
		i++
		while (i < text.length) {
			if (text[i] === '\\' && i + 1 < text.length) {
				result += '  '
				i += 2
				continue
			}
			if (text[i] === '$' && text[i + 1] === '{') {
				let depth = 1
				let j = i + 2
				while (j < text.length && depth > 0) {
					if (text[j] === '{') depth++
					else if (text[j] === '}') depth--
					j++
				}
				result += text.slice(i, j)
				i = j
				continue
			}
			if (text[i] === '`') {
				result += '`'
				i++
				break
			}
			result += ' '
			i++
		}
	}
	return result
}

export function isInsideHtmlComment(text: string, position: number): boolean {
	const commentRegex = /<!--[\s\S]*?-->/g
	let match: RegExpExecArray | null
	commentRegex.lastIndex = 0
	while ((match = commentRegex.exec(text)) !== null) {
		if (position >= match.index && position < match.index + match[0].length) {
			return true
		}
	}
	return false
}
