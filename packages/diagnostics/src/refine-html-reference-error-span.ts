/**
 * When SSR throws ReferenceError for a simple identifier, V8 often reports a misleading
 * line/column in the .html file because the HTML→JS pipeline returns no source map
 * (`map: null` in the Aero Vite transform). Prefer the real template interpolation site
 * when it is unambiguous.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { AeroDiagnosticSpan } from './types'

const SIMPLE_REFERENCE = /^([A-Za-z_$][\w$]*) is not defined$/

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

/**
 * If `err` is ReferenceError with message `id is not defined`, `span` points at a `.html`
 * file, and that file contains exactly one braced `{… id …}` occurrence, return a span
 * whose line/column point at `id` in the source. Otherwise return undefined.
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

	const re = bracedIdentifierPattern(id)
	const matches = [...source.matchAll(re)]
	if (matches.length !== 1) return undefined

	const full = matches[0]!
	const inner = full[0]!
	const rel = inner.search(new RegExp(`\\b${escapeRegExp(id)}\\b`))
	if (rel < 0) return undefined
	const idOffset = full.index! + rel
	const loc = offsetToLineColumn1BasedLine0BasedCol(source, idOffset)
	return {
		file: spanFile,
		line: loc.line,
		column: loc.column,
	}
}
