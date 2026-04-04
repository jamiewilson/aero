/**
 * Intermediate layout representation for a single diagnostic.
 *
 * Both terminal and HTML renderers consume `DiagnosticSection[]` instead of
 * independently reconstructing the same field order / conditional logic.
 */

import {
	bannerTitleForCode,
	diagnosticFileLocationLine,
	DIAGNOSTIC_FIELD_LABELS,
	makeBanner,
} from '../diagnostic-display'
import { diagnosticPathForDisplay } from '../path-display'
import type { AeroDiagnostic } from '../types'

export type DiagnosticSectionKind =
	| 'banner-top'
	| 'index'
	| 'file'
	| 'error'
	| 'frame'
	| 'hint'
	| 'docs'
	| 'banner-bottom'

export interface DiagnosticSection {
	kind: DiagnosticSectionKind
	/** Field label (e.g. "File", "Error") when applicable. */
	label?: string
	/** The text content for this section. */
	value: string
}

export interface LayoutOptions {
	banners?: boolean
	compact?: boolean
}

/**
 * Build an ordered list of sections for one diagnostic.
 * Renderers map each section to their output format (plain text, HTML, etc.).
 */
export function layoutDiagnostic(
	d: AeroDiagnostic,
	index: number,
	total: number,
	opts: LayoutOptions = {}
): DiagnosticSection[] {
	const withBanners = opts.banners !== false && opts.compact !== true

	const sections: DiagnosticSection[] = []

	if (withBanners) {
		const title = bannerTitleForCode(d.code)
		const { header } = makeBanner(title)
		sections.push({ kind: 'banner-top', value: header })
	}

	if (total > 1) {
		sections.push({ kind: 'index', value: `(${index + 1} of ${total})` })
	}

	const loc = diagnosticFileLocationLine(d, diagnosticPathForDisplay)
	sections.push({
		kind: 'file',
		label: DIAGNOSTIC_FIELD_LABELS.file,
		value: loc ?? '(unknown)',
	})

	sections.push({
		kind: 'error',
		label: DIAGNOSTIC_FIELD_LABELS.error,
		value: d.message,
	})

	if (d.frame && d.frame.length > 0) {
		sections.push({ kind: 'frame', value: d.frame })
	}

	if (d.hint) {
		sections.push({
			kind: 'hint',
			label: DIAGNOSTIC_FIELD_LABELS.hint,
			value: d.hint,
		})
	}

	if (d.docsUrl) {
		sections.push({
			kind: 'docs',
			label: DIAGNOSTIC_FIELD_LABELS.docs,
			value: d.docsUrl,
		})
	}

	if (withBanners) {
		const title = bannerTitleForCode(d.code)
		const { footer } = makeBanner(title)
		sections.push({ kind: 'banner-bottom', value: footer })
	}

	return sections
}

/**
 * Compact (plain) layout for CI / single-line logging.
 * Produces a flat text block without banners or structured labels.
 */
export function layoutDiagnosticCompact(d: AeroDiagnostic, index: number, total: number): string {
	const prefix = total > 1 ? `${index + 1}/${total} ` : ''
	const fileDisp = d.file ? diagnosticPathForDisplay(d.file) : ''
	const where = fileDisp ? (d.span ? `${fileDisp}:${d.span.line}:${d.span.column}` : fileDisp) : ''
	const loc = where ? ` ${where}` : ''
	const hint = d.hint ? `\n  hint: ${d.hint}` : ''
	const docs = d.docsUrl ? `\n  docs: ${d.docsUrl}` : ''
	const frame = d.frame && d.frame.length > 0 ? `\n${d.frame}` : ''
	return `[aero] ${prefix}[${d.code}]${loc}\n  ${d.severity}: ${d.message}${hint}${docs}${frame}`
}
