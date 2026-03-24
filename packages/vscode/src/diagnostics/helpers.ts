/**
 * Shared diagnostic helpers: HTML comment/script masking, position checks.
 */
import { getIgnoredRanges, isInRanges, type IgnoredRange } from '../utils'

export { getIgnoredRanges, isInRanges, type IgnoredRange }

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
