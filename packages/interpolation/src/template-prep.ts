import {
	collectInterpolationBodyRanges,
	collectScriptStyleInnerRanges,
	escapeInterpolationBodyMarkup,
} from './markup-escape.js'
import type { ByteRange } from './tokenizer.js'

/** Matches HTML comment blocks. */
const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g

/** Collect byte ranges of HTML comments. */
export function collectHtmlCommentRanges(text: string): ByteRange[] {
	const ranges: ByteRange[] = []
	HTML_COMMENT_REGEX.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = HTML_COMMENT_REGEX.exec(text)) !== null) {
		ranges.push({ start: match.index, end: match.index + match[0].length })
	}
	return ranges
}

/** Mask `for="..."` attribute values before text interpolation scan. */
export function maskForDirectiveValues(sourceText: string): string {
	return sourceText.replace(
		/\b(?:aero-|data-aero-)?for\s*=\s*(['"])([\s\S]*?)\1/gi,
		(match, _q: string, inner: string) => match.replace(inner, ' '.repeat(inner.length))
	)
}

/** Full `{...}` spans (inclusive of braces) for diagnostic scanners. */
export function collectInterpolationSpans(text: string): ByteRange[] {
	return collectInterpolationBodyRanges(text, { attributeMode: false }).map(range => ({
		start: range.start - 1,
		end: range.end + 1,
	}))
}

export type AeroTemplatePrep = {
	readonly htmlSafeText: string
	readonly restore: (value: string) => string
	readonly ignoreZones: ByteRange[]
	readonly interpolationSpans: ByteRange[]
}

function mergeRanges(ranges: readonly ByteRange[]): ByteRange[] {
	if (ranges.length <= 1) return [...ranges]
	const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end)
	const merged: ByteRange[] = []
	for (const range of sorted) {
		const last = merged[merged.length - 1]
		if (last && range.start <= last.end) {
			last.end = Math.max(last.end, range.end)
		} else {
			merged.push({ start: range.start, end: range.end })
		}
	}
	return merged
}

/**
 * Canonical lexical preparation for Aero `.html` templates.
 *
 * @remarks
 * All HTML parsers and regex scanners on Aero templates should use this API so
 * interpolation bodies, script/style inners, and comments are handled consistently.
 */
export function prepareAeroTemplateSource(text: string): AeroTemplatePrep {
	const { text: htmlSafeText, restore } = escapeInterpolationBodyMarkup(text)
	const interpolationSpans = collectInterpolationSpans(text)
	return {
		htmlSafeText,
		restore,
		ignoreZones: mergeRanges([
			...collectHtmlCommentRanges(text),
			...collectScriptStyleInnerRanges(text),
			...interpolationSpans,
		]),
		interpolationSpans,
	}
}
