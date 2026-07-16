/**
 * Map thrown values to AeroDiagnostic[] for catch blocks before tagged errors exist everywhere.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { AeroDiagnostic, AeroDiagnosticCode, AeroDiagnosticSpan } from './types'
import { failureToAeroDiagnostics } from './cause-map'
import { AeroBuildCancelledError, AeroCompileError } from './tagged-errors'
import {
	contentSchemaIssuePayloadsToDiagnostics,
	isContentSchemaAggregateError,
} from './content-schema-aggregate'
import { augmentFromCssSyntaxError } from './css-postcss-error'
import { firstStackSpan } from './stack-frame'
import { stripAeroViteMessageDecorations } from './vite-error'

function isCompileError(
	err: unknown
): err is {
	message: string
	file?: string
	line?: number
	column?: number
	code?: 'AERO_COMPILE' | 'AERO_CONFIG'
} {
	return err instanceof Error && err.name === 'CompileError'
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null
}

interface ViteErrorMeta {
	id?: string
	frame?: string
	loc?: { file?: string; line?: number; column?: number }
}

function viteErrorMeta(err: Error): ViteErrorMeta {
	const record = err as Error & ViteErrorMeta
	return {
		...(typeof record.id === 'string' ? { id: record.id } : {}),
		...(typeof record.frame === 'string' ? { frame: record.frame } : {}),
		...(record.loc && typeof record.loc === 'object' ? { loc: record.loc } : {}),
	}
}

const SIMPLE_REFERENCE = /^([A-Za-z_$][\w$]*) is not defined$/

function resolveFsPath(filePath: string): string {
	if (path.isAbsolute(filePath)) return filePath
	if (typeof process === 'undefined' || typeof process.cwd !== 'function') return filePath
	return path.resolve(process.cwd(), filePath)
}

/**
 * First non-comment `\bid\b` in `source` as a 1-based-line / 0-based-column span.
 * `is not defined` always fails at the first evaluation of the binding.
 */
function firstLiveIdentifierSpan(
	spanFile: string,
	source: string,
	id: string
): AeroDiagnosticSpan | undefined {
	const idRe = new RegExp(`\\b${id.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')}\\b`, 'g')
	for (const m of source.matchAll(idRe)) {
		const abs = m.index ?? 0
		const lineStart = source.lastIndexOf('\n', abs - 1) + 1
		const lineEnd = source.indexOf('\n', abs)
		const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd)
		if (/^\s*\/\//.test(line) || /^\s*\/\*/.test(line)) continue
		const before = source.slice(0, abs)
		const lastBlockOpen = before.lastIndexOf('/*')
		const lastBlockClose = before.lastIndexOf('*/')
		if (lastBlockOpen > lastBlockClose) continue
		let lineNum = 1
		for (let i = 0; i < abs; i++) if (source.charCodeAt(i) === 10) lineNum++
		return { file: spanFile, line: lineNum, column: abs - lineStart }
	}
	return undefined
}

/** `demoList` → `demo-list` (component import binding → tag base). */
function camelToKebabCase(id: string): string {
	return id.replace(/[A-Z]/g, ch => `-${ch.toLowerCase()}`)
}

/**
 * Component bindings are camelCase in `<script is:build>` but kebab tags in markup
 * (`demoList` → `<demo-list-component>`). Fall back when the camelCase id is absent.
 */
function firstLiveComponentTagSpan(
	spanFile: string,
	source: string,
	camelId: string
): AeroDiagnosticSpan | undefined {
	const kebab = camelToKebabCase(camelId)
	const escaped = kebab.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
	const tagRe = new RegExp(`<(${escaped}-(?:component|layout))\\b`, 'g')
	for (const m of source.matchAll(tagRe)) {
		const abs = (m.index ?? 0) + 1 // caret on tag name, not `<`
		const lineStart = source.lastIndexOf('\n', abs - 1) + 1
		const lineEnd = source.indexOf('\n', abs)
		const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd)
		if (/^\s*\/\//.test(line) || /^\s*\/\*/.test(line)) continue
		const before = source.slice(0, abs)
		const lastBlockOpen = before.lastIndexOf('/*')
		const lastBlockClose = before.lastIndexOf('*/')
		if (lastBlockOpen > lastBlockClose) continue
		let lineNum = 1
		for (let i = 0; i < abs; i++) if (source.charCodeAt(i) === 10) lineNum++
		return { file: spanFile, line: lineNum, column: abs - lineStart }
	}
	return undefined
}

/**
 * ReferenceError stacks for HTML modules are often remapped to a later duplicate of the
 * identifier (state script is emitted more than once). Snap to the first live occurrence.
 */
function dropMisleadingHtmlReferenceSpan(
	err: Error,
	span: AeroDiagnosticSpan | undefined,
	diagFile: string | undefined
): AeroDiagnosticSpan | undefined {
	if (err.name !== 'ReferenceError') return span
	const m = SIMPLE_REFERENCE.exec((err.message || '').trim())
	if (!m) return span
	const id = m[1]!
	const file = span?.file || diagFile
	if (!file || !file.endsWith('.html')) return span

	const resolved = resolveFsPath(file)
	if (!existsSync(resolved)) return span
	let source: string
	try {
		source = readFileSync(resolved, 'utf8')
	} catch {
		return span
	}

	const idSpan = firstLiveIdentifierSpan(file, source, id)
	return idSpan ?? firstLiveComponentTagSpan(file, source, id)
}

/**
 * Map a generic Error with contextFile-specific enrichment (CSS path promotion).
 *
 * Stack locations for HTML modules are expected to be remapped via compiler source maps.
 * When a ReferenceError stack still points at a `.html` line that does not contain the
 * missing identifier, drop the span so we do not draw a confident wrong caret.
 */
function errorWithContextToDiagnostic(
	err: Error,
	code: AeroDiagnosticCode,
	contextFile: string | undefined
): AeroDiagnostic {
	const css = augmentFromCssSyntaxError(err)
	const vite = viteErrorMeta(err)
	const parsedMessage = stripAeroViteMessageDecorations(err.message || String(err))
	const stackSpan = css || vite.loc || vite.id ? undefined : firstStackSpan(err.stack)
	let diagFile = css?.file ?? (vite.loc?.file || vite.id) ?? stackSpan?.file ?? contextFile
	let span =
		css?.span ??
		(vite.loc?.line !== undefined
			? {
					file: vite.loc.file ?? vite.id ?? diagFile ?? '',
					line: vite.loc.line,
					column: vite.loc.column ?? 0,
				}
			: stackSpan
				? { file: stackSpan.file, line: stackSpan.line, column: stackSpan.column }
				: undefined)

	const promoteInlineCssPath =
		css != null &&
		Boolean(contextFile) &&
		css.hint?.includes('inline <style>') === true &&
		path.normalize(contextFile!) !== path.normalize(css.file)

	if (promoteInlineCssPath) {
		diagFile = contextFile!
		if (span) span = { ...span, file: contextFile! }
	}

	span = dropMisleadingHtmlReferenceSpan(err, span, diagFile)

	const hint = css?.hint

	return {
		code: parsedMessage.code ?? code,
		severity: 'error',
		message: css?.message ?? parsedMessage.message,
		file: diagFile,
		span,
		...(css?.frame
			? { frame: css.frame }
			: vite.frame && span
				? { frame: vite.frame }
				: {}),
		...(hint ? { hint } : {}),
	}
}

/**
 * Normalize unknown caught errors into one or more diagnostics.
 */
export function unknownToAeroDiagnostics(
	err: unknown,
	base: { file?: string; code?: AeroDiagnosticCode } = {}
): AeroDiagnostic[] {
	const code: AeroDiagnosticCode = base.code ?? 'AERO_COMPILE'
	const file = base.file

	if (err instanceof AeroBuildCancelledError) {
		return failureToAeroDiagnostics(err)
	}

	if (err instanceof AeroCompileError) {
		const fromTagged = failureToAeroDiagnostics(err)
		return fromTagged.map(d => (file && !d.file ? { ...d, file } : d))
	}

	if (isContentSchemaAggregateError(err)) {
		return contentSchemaIssuePayloadsToDiagnostics(err.issues).map(d =>
			file && !d.file ? { ...d, file } : d
		)
	}

	if (isCompileError(err)) {
		const span =
			err.file !== undefined && err.line !== undefined
				? { file: err.file, line: err.line, column: err.column ?? 0 }
				: undefined
		const compileCode = err.code === 'AERO_CONFIG' || err.code === 'AERO_COMPILE' ? err.code : 'AERO_COMPILE'
		return [
			{
				code: compileCode,
				severity: 'error',
				message: err.message,
				file: err.file,
				span,
			},
		]
	}

	if (err instanceof Error) {
		return [errorWithContextToDiagnostic(err, code, file)]
	}

	if (typeof err === 'string') {
		return [{ code, severity: 'error', message: err, file }]
	}

	if (isRecord(err) && typeof err.message === 'string') {
		return [{ code, severity: 'error', message: err.message, file }]
	}

	return [
		{
			code: 'AERO_INTERNAL',
			severity: 'error',
			message: `Unknown error: ${String(err)}`,
			file,
		},
	]
}
