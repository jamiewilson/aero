/**
 * Swappable renderer contract for diagnostic output (terminal, HTML, JSON, etc.).
 *
 * Inspired by rustc's `Emitter` trait and miette's `ReportHandler`:
 * data flows in as `AeroDiagnostic[]`, output type is generic.
 */

import type { AeroDiagnostic } from '../types'

export interface RenderOptions {
	/** Include top/bottom banner lines around each diagnostic block. Default true. */
	banners?: boolean
	/** Compact single-line output (e.g. CI logs). Default false. */
	compact?: boolean
}

export interface DiagnosticRenderer<TOutput> {
	renderDiagnostics(diagnostics: readonly AeroDiagnostic[], options?: RenderOptions): TOutput
	renderOne(
		diagnostic: AeroDiagnostic,
		index: number,
		total: number,
		options?: RenderOptions
	): TOutput
}
