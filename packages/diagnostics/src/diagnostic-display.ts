/**
 * Shared presentation constants for Aero diagnostics: human titles, banner lines, and field labels.
 * Consumed by {@link ./render/layout} and {@link ./error-page}.
 */

import type { AeroDiagnostic, AeroDiagnosticCode } from './types'

/**
 * Character repeated for diagnostic banner lines (header with centered title + full-width footer).
 * Change this one value to retheme every banner in terminal and browser output.
 */
export const DIAGNOSTIC_BANNER_CHAR = '―'

export interface MakeBannerOptions {
	/** Minimum total width of the header/footer lines. Default 35. */
	minWidth?: number
	/** Repeat character; defaults to {@link DIAGNOSTIC_BANNER_CHAR}. */
	char?: string
}

/**
 * Centered banner header (`char… title char…`) and a full-width footer line of the same character.
 */
export function makeBanner(
	title: string,
	options: MakeBannerOptions = {}
): { header: string; footer: string } {
	const minWidth = options.minWidth ?? 35
	const char = options.char ?? DIAGNOSTIC_BANNER_CHAR
	const fill = char.length > 0 ? char : DIAGNOSTIC_BANNER_CHAR

	const padded = ` ${title.trim()} `
	const target = Math.max(minWidth, padded.length + 4)
	const pad = target - padded.length
	const left = Math.floor(pad / 2)
	const right = pad - left
	const header = fill.repeat(left) + padded + fill.repeat(right)
	const footer = fill.repeat(target)
	return { header, footer }
}

/** Banner title shown between equals — one string per stable {@link AeroDiagnosticCode}. */
export const DIAGNOSTIC_BANNER_TITLE: Record<AeroDiagnosticCode, string> = {
	AERO_COMPILE: 'Aero Compiler Error',
	AERO_PARSE: 'Aero Parse Error',
	AERO_RESOLVE: 'Aero Import Error',
	AERO_ROUTE: 'Aero Route Error',
	AERO_TEMPLATE: 'Aero Template Warning',
	AERO_SWITCH: 'Aero Switch Warning',
	AERO_CONTENT_SCHEMA: 'Aero Content Schema Error',
	AERO_CONFIG: 'Aero Config Error',
	AERO_BUILD_SCRIPT: 'Aero Build Script Error',
	AERO_INTERNAL: 'Aero Internal Error',
}

export function bannerTitleForCode(code: AeroDiagnosticCode): string {
	return DIAGNOSTIC_BANNER_TITLE[code] ?? DIAGNOSTIC_BANNER_TITLE.AERO_INTERNAL
}

export interface DiagnosticFieldLabels {
	readonly file: 'File'
	readonly error: 'Error'
	readonly hint: 'Hint'
	readonly docs: 'Docs'
}

export const DIAGNOSTIC_FIELD_LABELS: DiagnosticFieldLabels = {
	file: 'File',
	error: 'Error',
	hint: 'Hint',
	docs: 'Docs',
}

/** Location string for `File:` line, or empty if unknown. */
export function diagnosticFileLocationLine(
	d: AeroDiagnostic,
	displayPath: (absPath: string) => string
): string | undefined {
	const fileDisp = d.file ? displayPath(d.file) : ''
	if (!fileDisp) return undefined
	if (!d.span) return fileDisp
	return `${fileDisp}:${d.span.line}:${d.span.column}`
}
