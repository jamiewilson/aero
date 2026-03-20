/**
 * Normalize Rolldown/Vite-style code frames: dedent embedded template/CSS snippets and expand tabs for terminals.
 */

/** Lines that embed template/CSS text with different indent than real JS — exclude from shared dedent. */
const BOILERPLATE_SNIPPET_LINE =
	/^\s*(__out\s*\+=|let\s+__out_style_\w+\s*=|return\s+__out\b)/

function leadingWhitespaceRunLength(s: string): number {
	let i = 0
	while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++
	return i
}

function stripLeadingWhitespaceRun(s: string, chars: number): string {
	let i = 0
	let removed = 0
	while (
		i < s.length &&
		removed < chars &&
		(s[i] === ' ' || s[i] === '\t')
	) {
		i++
		removed++
	}
	return s.slice(i)
}

const DISPLAY_TAB_WIDTH = 2
function expandTabsForDisplay(s: string): string {
	return s.replace(/\t/g, ' '.repeat(DISPLAY_TAB_WIDTH))
}

/**
 * Dedent code-frame bodies so embedded template/CSS whitespace does not skew the display.
 *
 * @param errorLine - 1-based line index from the parser; shifts the `^` caret when dedenting.
 */
export function normalizeParseErrorFrame(
	frame: string,
	errorLine?: number
): string {
	const lines = frame.split('\n')
	const parsed: Array<
		| { kind: 'num'; prefix: string; body: string; lineNum: number }
		| { kind: 'caret'; before: string; marker: string }
		| { kind: 'other'; text: string }
	> = []

	for (const rawLine of lines) {
		const line = rawLine.replace(/\r$/, '')
		const num = /^(\s*)(\d+)(\s+\|)( ?)(.*)$/.exec(line)
		if (num) {
			parsed.push({
				kind: 'num',
				prefix: num[1]! + num[2]! + num[3]! + (num[4] ?? ''),
				body: num[5] ?? '',
				lineNum: parseInt(num[2]!, 10),
			})
			continue
		}
		const caret = /^(\s*\|)( ?)([\^~\s]+)$/.exec(line)
		if (caret && /[\^~]/.test(caret[3] ?? '')) {
			parsed.push({
				kind: 'caret',
				before: caret[1]! + (caret[2] ?? ''),
				marker: caret[3]!,
			})
			continue
		}
		parsed.push({ kind: 'other', text: line })
	}

	const numbered = parsed.filter((p): p is Extract<
		(typeof parsed)[number],
		{ kind: 'num' }
	> => p.kind === 'num')

	const bodiesForMin = numbered
		.map(r => r.body)
		.filter(b => b.trim().length > 0)
		.filter(b => !BOILERPLATE_SNIPPET_LINE.test(b))

	const minIndent =
		bodiesForMin.length > 0
			? Math.min(...bodiesForMin.map(leadingWhitespaceRunLength))
			: 0

	if (minIndent <= 0) {
		return frame
	}

	const errorRow = numbered.find(r => r.lineNum === errorLine)
	const caretShift =
		errorRow && !BOILERPLATE_SNIPPET_LINE.test(errorRow.body) ? minIndent : 0

	const out: string[] = []
	for (const p of parsed) {
		if (p.kind === 'num') {
			const strip = BOILERPLATE_SNIPPET_LINE.test(p.body) ? 0 : minIndent
			const body = expandTabsForDisplay(
				stripLeadingWhitespaceRun(p.body, strip),
			)
			out.push(p.prefix + body)
		} else if (p.kind === 'caret' && caretShift > 0) {
			const m = p.marker
			const idx = m.search(/[\^~]/)
			if (idx <= 0) {
				out.push(p.before + m)
				continue
			}
			const pad = m.slice(0, idx)
			const rest = m.slice(idx)
			out.push(p.before + stripLeadingWhitespaceRun(pad, caretShift) + rest)
		} else if (p.kind === 'caret') {
			out.push(p.before + p.marker)
		} else {
			out.push(p.text)
		}
	}
	return out.join('\n')
}
