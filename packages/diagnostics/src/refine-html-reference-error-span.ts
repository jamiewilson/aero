/**
 * When SSR throws ReferenceError for a simple identifier, V8 often reports a misleading
 * line/column in the .html file because the HTML→JS pipeline returns no source map
 * (`map: null` in the Aero Vite transform). Prefer the real template / state-script site
 * when the stack line clearly does not contain the identifier.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { AeroDiagnosticSpan } from './types'

const SIMPLE_REFERENCE = /^([A-Za-z_$][\w$]*) is not defined$/
/** `<script is:state>` … `</script>` (attribute order flexible; body non-greedy). */
const STATE_SCRIPT_BLOCK =
	/<script\b[^>]*\bis:state\b[^>]*>([\s\S]*?)<\/script>/gi

function escapeRegExp(s: string): string {
	return s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
}

function resolveFsPath(filePath: string): string {
	if (path.isAbsolute(filePath)) return filePath
	if (typeof process === 'undefined' || typeof process.cwd !== 'function') return filePath
	return path.resolve(process.cwd(), filePath)
}

/**
 * `{ … id … }` template interpolation / directive value (single brace pair, non-greedy).
 */
function bracedIdentifierPattern(id: string): RegExp {
	return new RegExp(`\\{[^}]*\\b${escapeRegExp(id)}\\b[^}]*\\}`, 'g')
}

function offsetToLineColumn1BasedLine0BasedCol(
	source: string,
	offset: number
): Pick<AeroDiagnosticSpan, 'line' | 'column'> {
	const before = source.slice(0, offset)
	const lines = before.split(/\r?\n/)
	const line = lines.length
	const column = (lines[lines.length - 1] ?? '').length
	return { line, column }
}

function lineContainsIdentifier(source: string, line1Based: number | undefined, id: string): boolean {
	if (line1Based === undefined || line1Based < 1) return false
	const lineText = source.split(/\r?\n/)[line1Based - 1] ?? ''
	return new RegExp(`\\b${escapeRegExp(id)}\\b`).test(lineText)
}

function spanAtIdentifierInMatch(
	spanFile: string,
	source: string,
	matchIndex: number,
	matchText: string,
	id: string
): AeroDiagnosticSpan | undefined {
	const rel = matchText.search(new RegExp(`\\b${escapeRegExp(id)}\\b`))
	if (rel < 0) return undefined
	const loc = offsetToLineColumn1BasedLine0BasedCol(source, matchIndex + rel)
	return { file: spanFile, line: loc.line, column: loc.column }
}

/**
 * First `\bid\b` inside a `<script is:state>` body (absolute offset in `source`).
 */
function firstStateScriptIdentifierSpan(
	spanFile: string,
	source: string,
	id: string
): AeroDiagnosticSpan | undefined {
	const idRe = new RegExp(`\\b${escapeRegExp(id)}\\b`)
	for (const block of source.matchAll(STATE_SCRIPT_BLOCK)) {
		const full = block[0]!
		const body = block[1] ?? ''
		const blockIndex = block.index ?? 0
		const openTagEnd = full.indexOf('>') + 1
		if (openTagEnd <= 0) continue
		const m = idRe.exec(body)
		if (!m) continue
		const loc = offsetToLineColumn1BasedLine0BasedCol(source, blockIndex + openTagEnd + m.index)
		return { file: spanFile, line: loc.line, column: loc.column }
	}
	return undefined
}

/**
 * If `err` is ReferenceError with message `id is not defined` and `span` points at a `.html`
 * file whose reported line does not contain `id`, remap to:
 * 1. first `id` in `<script is:state>`, or
 * 2. the sole braced `{… id …}` occurrence in the file.
 * Otherwise return undefined (keep the incoming span).
 */
export function tryRefineHtmlReferenceErrorSpan(
	err: unknown,
	span: AeroDiagnosticSpan | undefined,
	topLevelFile: string | undefined
): AeroDiagnosticSpan | undefined {
	if (!(err instanceof Error) || err.name !== 'ReferenceError') return undefined
	const m = SIMPLE_REFERENCE.exec((err.message || '').trim())
	if (!m) return undefined
	const id = m[1]!
	const spanFile = span?.file && span.file.length > 0 ? span.file : topLevelFile
	if (!spanFile || !spanFile.endsWith('.html')) return undefined

	const resolved = resolveFsPath(spanFile)
	if (!existsSync(resolved)) return undefined

	let source: string
	try {
		source = readFileSync(resolved, 'utf8')
	} catch {
		return undefined
	}

	const spanLineHasId = lineContainsIdentifier(source, span?.line, id)
	const bracedMatches = [...source.matchAll(bracedIdentifierPattern(id))]
	const stateSpan = firstStateScriptIdentifierSpan(spanFile, source, id)

	// Stack already points at a real occurrence of `id` in the HTML source.
	if (spanLineHasId) return undefined

	if (stateSpan) return stateSpan

	if (bracedMatches.length !== 1) return undefined
	const full = bracedMatches[0]!
	return spanAtIdentifierInMatch(spanFile, source, full.index!, full[0]!, id)
}
