/**
 * Plain-text diagnostic renderer for terminal / CI output.
 *
 * Consumes {@link DiagnosticSection} from the shared layout so terminal and
 * browser output stay structurally aligned without duplicating conditional logic.
 */

import type { AeroDiagnostic } from '../types'
import type { DiagnosticRenderer, RenderOptions } from './renderer'
import { type DiagnosticSection, layoutDiagnostic, layoutDiagnosticCompact } from './layout'

export interface FormatDiagnosticsTerminalOptions {
	/** When true, emit a single compact block per diagnostic (legacy `[aero] [CODE] …`, CI-friendly). */
	plain?: boolean
	/**
	 * When true (default), include `======= … =======` banners. When false, emit structured
	 * `File:` / `Error:` / frame / `Hint:` without top/bottom equals lines (narrow logs).
	 */
	pretty?: boolean
}

function sectionToText(s: DiagnosticSection): string {
	switch (s.kind) {
		case 'banner-top':
		case 'banner-bottom':
			return s.value
		case 'index':
			return s.value
		case 'file':
		case 'error':
		case 'hint':
			return `${s.label}: ${s.value}`
		case 'frame':
			return s.value
		case 'docs':
			return `${s.label}: ${s.value}`
	}
}

function sectionsToTerminalBlock(sections: DiagnosticSection[]): string {
	const lines: string[] = []
	for (let i = 0; i < sections.length; i++) {
		const s = sections[i]!
		const prev = i > 0 ? sections[i - 1]! : undefined

		const needsBlankBefore =
			(s.kind === 'index' && prev?.kind === 'banner-top') ||
			(s.kind === 'file' && prev?.kind === 'index') ||
			(s.kind === 'frame' && prev?.kind === 'error') ||
			(s.kind === 'hint' && (prev?.kind === 'frame' || prev?.kind === 'error')) ||
			(s.kind === 'docs' && prev?.kind === 'hint') ||
			(s.kind === 'banner-bottom')

		if (needsBlankBefore) {
			lines.push('')
		}

		lines.push(sectionToText(s))
	}
	return lines.join('\n')
}

export const terminalRenderer: DiagnosticRenderer<string> = {
	renderOne(
		diagnostic: AeroDiagnostic,
		index: number,
		total: number,
		options?: RenderOptions
	): string {
		if (options?.compact) {
			return layoutDiagnosticCompact(diagnostic, index, total)
		}
		const sections = layoutDiagnostic(diagnostic, index, total, {
			banners: options?.banners,
			compact: options?.compact,
		})
		return sectionsToTerminalBlock(sections)
	},

	renderDiagnostics(
		diagnostics: readonly AeroDiagnostic[],
		options?: RenderOptions
	): string {
		if (diagnostics.length === 0) return ''
		return diagnostics
			.map((d, i) => terminalRenderer.renderOne(d, i, diagnostics.length, options))
			.join('\n\n')
	},
}

/**
 * Format diagnostics as newline-separated blocks suitable for stderr / logs.
 *
 * Drop-in replacement for the previous `formatDiagnosticsTerminal` function.
 */
export function formatDiagnosticsTerminal(
	diagnostics: readonly AeroDiagnostic[],
	options: FormatDiagnosticsTerminalOptions = {}
): string {
	return terminalRenderer.renderDiagnostics(diagnostics, {
		compact: options.plain === true,
		banners: options.plain ? false : options.pretty !== false,
	})
}
