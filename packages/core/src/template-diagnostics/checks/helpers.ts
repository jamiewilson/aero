/**
 * Shared diagnostic helpers: HTML comment/script masking, position checks.
 */
export {
	getIgnoredRanges,
	isInRanges,
	type IgnoredRange,
} from '../utils'

export interface ByteRange {
	readonly start: number
	readonly end: number
}

/** Byte offset where a tag's attribute section begins (immediately after `<tagName`). */
export function attributeSectionBase(tagStart: number, tagName: string): number {
	return tagStart + 1 + tagName.length
}

/** Raw attribute substring inside an opening tag (excluding `<tagName` and closing `>` / `/>`). */
export function sliceRawAttrs(tagName: string, fullTag: string): string {
	const innerStart = 1 + tagName.length
	const innerEnd = fullTag.endsWith('/>') ? fullTag.length - 2 : fullTag.length - 1
	return fullTag.slice(innerStart, innerEnd)
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Locate an attribute (`name`, `name="..."`, or `name='...'`) within a tag's attribute slice. */
export function findAttributeRange(
	attrs: string,
	attrBase: number,
	attrName: string
): ByteRange | null {
	const valuedRe = new RegExp(
		`(?:^|\\s)(${escapeRegExp(attrName)})\\s*=\\s*(["'])([\\s\\S]*?)\\2`
	)
	const valuedMatch = valuedRe.exec(attrs)
	if (valuedMatch && valuedMatch.index !== undefined) {
		const leading = valuedMatch[0].length - valuedMatch[0].trimStart().length
		return {
			start: attrBase + valuedMatch.index + leading,
			end: attrBase + valuedMatch.index + valuedMatch[0].length,
		}
	}

	const bareRe = new RegExp(`(?:^|\\s)(${escapeRegExp(attrName)})(?=\\s|/?>|$)`)
	const bareMatch = bareRe.exec(attrs)
	if (bareMatch && bareMatch.index !== undefined) {
		const leading = bareMatch[0].length - bareMatch[0].trimStart().length
		const start = attrBase + bareMatch.index + leading
		return { start, end: start + attrName.length }
	}

	return null
}

/** Range covering only the opening tag name (`<header-component`). */
export function findTagNameRange(tagStart: number, tagName: string): ByteRange {
	return { start: tagStart, end: tagStart + 1 + tagName.length }
}

/** Check whether a position in the document is inside a `<head>` element. */
export function isInHead(text: string, position: number): boolean {
	const beforeText = text.slice(0, position)
	const lastMatchIndex = (source: string, pattern: RegExp): number => {
		let last = -1
		let match: RegExpExecArray | null
		while ((match = pattern.exec(source)) !== null) {
			last = match.index
		}
		return last
	}

	const headOpen = lastMatchIndex(beforeText, /<head(?:\s|>)/gi)
	const headClose = lastMatchIndex(beforeText, /<\/head\s*>/gi)
	return headOpen > headClose
}
