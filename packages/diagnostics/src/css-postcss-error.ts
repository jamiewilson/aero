/**
 * Map PostCSS / Tailwind {@link https://postcss.org/api/#csssyntaxerror CssSyntaxError}
 * into Aero locations.
 *
 * @remarks
 * Vite may use virtual ids like `page.html?html-proxy&index=0.css`.
 * Tailwind v4 uses a different shape than PostCSS: `loc` is
 * `[{ file, code }, startOffset, endOffset]` and the message is often
 * `file:line:col: reason` when compile `from` is set (Vite `css.devSourcemap`).
 */

import { formatSourceFrameFromSource } from './source-frame'
import { collapsePathSlashes } from './path-display'
import type { AeroDiagnosticSpan } from './types'

/**
 * Strip Vite virtual query from display path and describe inline `<style>` extracts.
 */
export function normalizePostcssDisplayPath(rawFile: string): {
	displayFile: string
	styleExtractHint?: string
} {
	const qIndex = rawFile.indexOf('?')
	const pathPart = (qIndex === -1 ? rawFile : rawFile.slice(0, qIndex)).trim().replace(/^\0+/, '')
	const displayFile = collapsePathSlashes(pathPart)

	if (!rawFile.includes('html-proxy')) {
		return { displayFile }
	}

	const query = qIndex === -1 ? '' : rawFile.slice(qIndex + 1)
	const indexMatch = query.match(/(?:^|&)index=(\d+)/)
	const n = indexMatch?.[1]
	return {
		displayFile,
		styleExtractHint: n
			? `CSS line/column refer to extracted inline <style> #${n}, not HTML line numbers.`
			: 'CSS line/column refer to extracted inline <style> CSS, not HTML line numbers.',
	}
}

function stripPostcssNoise(message: string): string {
	return message
		.replace(/^\[postcss\]\s+/i, '')
		.replace(/\s+/g, ' ')
		.trim()
}

/** Drop leading `path:line:col:` Vite/PostCSS often embeds in the message when we already have span. */
function stripDuplicateLocationFromMessage(
	message: string,
	file: string,
	line: number,
	column: number
): string {
	const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const re = new RegExp(`^${escaped}:${line}:${column}:\\s*`, 'i')
	let m = message.replace(re, '').trim()
	const reAnyPath = /^(?:\/|[A-Za-z]:\\|[^\s:]+\.(?:css|scss|sass|less|styl)).*?:\d+:\d+:\s*/
	if (m === message && reAnyPath.test(message)) {
		m = message.replace(reAnyPath, '').trim()
	}
	return m || message
}

/** Byte offset → 1-based line and column (PostCSS / Tailwind message convention). */
export function offsetToLineColumn(
	source: string,
	offset: number
): { line: number; column: number } {
	const clamped = Math.max(0, Math.min(offset, source.length))
	let line = 1
	let lineStart = 0
	for (let i = 0; i < clamped; i++) {
		if (source.charCodeAt(i) === 10) {
			line++
			lineStart = i + 1
		}
	}
	return { line, column: clamped - lineStart + 1 }
}

interface ResolvedCssLocation {
	rawFile: string
	line: number
	column: number
	source?: string
}

/**
 * Resolve file/line/column from PostCSS fields, Tailwind `loc` tuple, or `file:line:col:` message.
 */
function resolveCssSyntaxLocation(e: {
	message: string
	file?: string
	line?: number
	column?: number
	source?: string
	input?: { file?: string; line?: number; column?: number; source?: string }
	loc?: unknown
}): ResolvedCssLocation | null {
	const postcssFile = e.file ?? e.input?.file
	const postcssLine = e.line ?? e.input?.line
	const postcssColumn = e.column ?? e.input?.column
	if (postcssFile && postcssLine !== undefined && postcssColumn !== undefined) {
		const source =
			typeof e.source === 'string' && e.source.length > 0
				? e.source
				: typeof e.input?.source === 'string' && e.input.source.length > 0
					? e.input.source
					: undefined
		return { rawFile: postcssFile, line: postcssLine, column: postcssColumn, source }
	}

	// Tailwind v4: loc = [{ file, code }, startOffset, endOffset]
	const loc = e.loc
	if (Array.isArray(loc) && loc.length >= 2) {
		const head = loc[0]
		const start = loc[1]
		if (
			head &&
			typeof head === 'object' &&
			typeof (head as { file?: unknown }).file === 'string' &&
			typeof (head as { code?: unknown }).code === 'string' &&
			typeof start === 'number'
		) {
			const file = (head as { file: string }).file
			const code = (head as { code: string }).code
			const { line, column } = offsetToLineColumn(code, start)
			return { rawFile: file, line, column, source: code }
		}
	}

	// Message prefix when Vite drops `loc` but keeps `file:line:col: reason`
	const prefixed = stripPostcssNoise(e.message).match(
		/^((?:\/|[A-Za-z]:\\)?[^\n]+?\.(?:css|scss|sass|less|styl))(?::\w+)?:(\d+):(\d+):\s*([\s\S]*)$/
	)
	if (prefixed) {
		return {
			rawFile: prefixed[1]!,
			line: Number(prefixed[2]),
			column: Number(prefixed[3]),
		}
	}

	return null
}

/**
 * When `error.name === 'CssSyntaxError'`, return file/span/frame for diagnostics.
 */
export function augmentFromCssSyntaxError(err: Error): {
	message: string
	file: string
	span: AeroDiagnosticSpan
	frame?: string
	hint?: string
} | null {
	if (err.name !== 'CssSyntaxError') return null

	const e = err as Error & {
		reason?: string
		message: string
		file?: string
		line?: number
		column?: number
		source?: string
		input?: { file?: string; line?: number; column?: number; source?: string }
		loc?: unknown
		showSourceCode?: (color?: boolean) => string
	}

	const resolved = resolveCssSyntaxLocation(e)
	if (!resolved) return null

	const { rawFile, line, column, source } = resolved
	const { displayFile, styleExtractHint } = normalizePostcssDisplayPath(rawFile)

	const reason = typeof e.reason === 'string' ? e.reason.trim() : ''
	let message = reason || stripPostcssNoise(err.message)
	message = stripDuplicateLocationFromMessage(message, rawFile.split('?')[0]!, line, column)
	message = stripDuplicateLocationFromMessage(message, displayFile, line, column)
	if (!message) message = stripPostcssNoise(err.message)

	let frame: string | undefined
	if (source !== undefined && source.length > 0) {
		// PostCSS/Tailwind column is 1-based; frame uses Rollup/Vite 0-based column.
		frame = formatSourceFrameFromSource(source, line, Math.max(0, column - 1))
	} else {
		try {
			frame = e.showSourceCode?.(false)?.trim()
		} catch {
			frame = undefined
		}
	}

	return {
		message,
		file: displayFile,
		span: { file: displayFile, line, column },
		...(frame ? { frame } : {}),
		...(styleExtractHint ? { hint: styleExtractHint } : {}),
	}
}
