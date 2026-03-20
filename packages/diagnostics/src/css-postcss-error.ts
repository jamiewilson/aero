/**
 * Map PostCSS {@link https://postcss.org/api/#csssyntaxerror CssSyntaxError} into Aero locations.
 * Vite prefixes messages with `[postcss]` and may use virtual ids like `page.html?html-proxy&index=0.css`.
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
	const pathPart = (qIndex === -1 ? rawFile : rawFile.slice(0, qIndex)).trim()
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
function stripDuplicateLocationFromMessage(message: string, file: string, line: number, column: number): string {
	const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const re = new RegExp(
		`^${escaped}:${line}:${column}:\\s*`,
		'i',
	)
	let m = message.replace(re, '').trim()
	const reAnyPath = /^(?:\/|[A-Za-z]:\\).*?:\d+:\d+:\s*/
	if (m === message && reAnyPath.test(message)) {
		m = message.replace(reAnyPath, '').trim()
	}
	return m || message
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
		showSourceCode?: (color?: boolean) => string
	}

	const rawFile = e.file ?? e.input?.file
	const line = e.line ?? e.input?.line
	const column = e.column ?? e.input?.column
	if (!rawFile || line === undefined || column === undefined) return null

	const { displayFile, styleExtractHint } = normalizePostcssDisplayPath(rawFile)

	const reason = typeof e.reason === 'string' ? e.reason.trim() : ''
	let message = reason || stripPostcssNoise(err.message)
	message = stripDuplicateLocationFromMessage(message, rawFile.split('?')[0]!, line, column)
	message = stripDuplicateLocationFromMessage(message, displayFile, line, column)
	if (!message) message = stripPostcssNoise(err.message)

	const fullSource =
		typeof e.source === 'string' && e.source.length > 0
			? e.source
			: typeof e.input?.source === 'string' && e.input.source.length > 0
				? e.input.source
				: undefined

	let frame: string | undefined
	if (fullSource !== undefined) {
		// PostCSS column is 1-based; frame uses Rollup/Vite 0-based column.
		frame = formatSourceFrameFromSource(fullSource, line, Math.max(0, column - 1))
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
