import { isOffsetInRanges, tokenizeCurlyInterpolation, type ByteRange } from './tokenizer.js'

const INTERPOLATION_BODY_LT_ESCAPE = '\uE000'

/** Mask `<script>` / `<style>` inner content so tokenizers skip JS/CSS bodies. */
export function maskScriptAndStyleInner(text: string): string {
	return text.replace(
		/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi,
		(match, _tag: string, inner: string) => match.replace(inner, ' '.repeat(inner.length))
	)
}

/** Collect byte ranges of `<script>` / `<style>` inner content. */
export function collectScriptStyleInnerRanges(text: string): ByteRange[] {
	const ranges: ByteRange[] = []
	const re = /<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi
	let match: RegExpExecArray | null
	while ((match = re.exec(text)) !== null) {
		const tagName = match[1]!
		const closeTagLen = `</${tagName}>`.length
		const innerLen = match[2]!.length
		const start = match.index + match[0].length - closeTagLen - innerLen
		ranges.push({ start, end: start + innerLen })
	}
	return ranges
}

function isMarkupLt(text: string, index: number): boolean {
	return /^[A-Za-z/!?]/.test(text.slice(index + 1))
}

/**
 * Escape `<` inside Aero `{ ... }` expression bodies so HTML parsers do not treat snippet
 * markup as real elements. Offsets are preserved; pair with {@link restoreInterpolationBodyMarkup}.
 */
export function escapeInterpolationBodyMarkup(
	text: string,
	options: { attributeMode?: boolean } = {}
): { text: string; restore: (value: string) => string } {
	const maskedForTokenize = maskScriptAndStyleInner(text)
	const scriptStyleRanges = collectScriptStyleInnerRanges(text)
	const chars = [...text]
	for (const seg of tokenizeCurlyInterpolation(maskedForTokenize, options)) {
		if (seg.kind !== 'interpolation') continue
		for (let i = seg.start + 1; i < seg.end - 1; i++) {
			if (isOffsetInRanges(i, scriptStyleRanges)) continue
			if (chars[i] === '<' && isMarkupLt(text, i)) chars[i] = INTERPOLATION_BODY_LT_ESCAPE
		}
	}
	return {
		text: chars.join(''),
		restore: value => restoreInterpolationBodyMarkup(value),
	}
}

/** Restore text produced by {@link escapeInterpolationBodyMarkup}. */
export function restoreInterpolationBodyMarkup(value: string): string {
	return value
		.replaceAll(INTERPOLATION_BODY_LT_ESCAPE, '<')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
}

export { collectInterpolationBodyRanges } from './tokenizer.js'
