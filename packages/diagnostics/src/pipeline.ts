/**
 * Unified Aero failure pipeline: normalize → enrich → render.
 *
 * @remarks
 * Call sites that own Aero failures should use these entry points instead of
 * hand-rolling `unknownTo*` / `enrich*` / formatter combinations.
 */

import type { AeroDiagnostic, AeroDiagnosticCode } from './types'
import { normalizeToDiagnostics, type NormalizeContext } from './from-unknown'
import { enrichDiagnosticsWithSourceFrames } from './source-frame'
import { formatDiagnosticsDevConsole } from './render/dev-console'
import { formatDiagnosticsTerminal } from './render/terminal'
import { formatDiagnosticsBrowserHtml } from './render/html'
import {
	AERO_DIAGNOSTICS_ERROR_PROP,
	aeroDiagnosticToViteErrorFields,
	type AeroViteErrorFields,
} from './vite-error-fields'
import { diagnosticsToSingleMessage } from './vite-error'

export type { NormalizeContext }

/** Surfaces that consume enriched {@link AeroDiagnostic} values. */
export type RenderSurface = 'dev-console' | 'terminal' | 'vite-overlay' | 'browser-html'

export interface EnrichContext {
	/** Fill missing `file` from span or this fallback (compile/Vite importer path). */
	defaultFile?: string
}

export interface RenderDiagnosticsOptions {
	/** Dev-console: ANSI colors. */
	colors?: boolean
	/** Dev-console: fixed clock for tests. */
	now?: Date
	/** Terminal: compact `[CODE]` lines (CLI). */
	plain?: boolean
	/** Terminal: equals banners (default true when not plain). */
	pretty?: boolean
	/** Browser HTML: equals banners. */
	banners?: boolean
	/** Vite overlay: plugin name stamped on the error. */
	plugin?: string
}

export type ViteOverlayRenderResult = AeroViteErrorFields & {
	[AERO_DIAGNOSTICS_ERROR_PROP]: readonly AeroDiagnostic[]
}

export type RenderDiagnosticsResult = string | ViteOverlayRenderResult

export type ReportAeroFailureContext = NormalizeContext & EnrichContext & RenderDiagnosticsOptions

export { normalizeToDiagnostics }

/**
 * Attach source frames when missing and the file is readable.
 * Optionally fill a default file path for diagnostics that only have a message.
 */
export function enrichDiagnostics(
	diagnostics: readonly AeroDiagnostic[],
	context: EnrichContext = {}
): AeroDiagnostic[] {
	const withFile =
		context.defaultFile !== undefined
			? diagnostics.map(d => ({
					...d,
					file: d.file ?? d.span?.file ?? context.defaultFile,
				}))
			: diagnostics
	return enrichDiagnosticsWithSourceFrames(withFile)
}

/**
 * Render enriched diagnostics for a single surface.
 *
 * @remarks
 * `vite-overlay` returns Rollup/Vite error fields and always attaches
 * {@link AERO_DIAGNOSTICS_ERROR_PROP} so the logger does not re-derive frames.
 */
export function renderDiagnostics(
	diagnostics: readonly AeroDiagnostic[],
	surface: 'vite-overlay',
	options?: RenderDiagnosticsOptions
): ViteOverlayRenderResult
export function renderDiagnostics(
	diagnostics: readonly AeroDiagnostic[],
	surface: Exclude<RenderSurface, 'vite-overlay'>,
	options?: RenderDiagnosticsOptions
): string
export function renderDiagnostics(
	diagnostics: readonly AeroDiagnostic[],
	surface: RenderSurface,
	options: RenderDiagnosticsOptions = {}
): RenderDiagnosticsResult {
	switch (surface) {
		case 'dev-console':
			return formatDiagnosticsDevConsole(diagnostics, {
				...(options.colors !== undefined ? { colors: options.colors } : {}),
				...(options.now !== undefined ? { now: options.now } : {}),
			})
		case 'terminal':
			return formatDiagnosticsTerminal(diagnostics, {
				...(options.plain !== undefined ? { plain: options.plain } : {}),
				...(options.pretty !== undefined ? { pretty: options.pretty } : {}),
			})
		case 'browser-html':
			return formatDiagnosticsBrowserHtml(diagnostics, {
				...(options.banners !== undefined ? { banners: options.banners } : {}),
			})
		case 'vite-overlay': {
			if (diagnostics.length === 0) {
				return {
					message: 'Unknown Aero failure',
					plugin: options.plugin ?? 'vite-plugin-aero',
					[AERO_DIAGNOSTICS_ERROR_PROP]: diagnostics,
				}
			}
			const fields = aeroDiagnosticToViteErrorFields(diagnostics[0]!, options.plugin)
			return {
				...(diagnostics.length > 1
					? { ...fields, message: diagnosticsToSingleMessage(diagnostics) }
					: fields),
				[AERO_DIAGNOSTICS_ERROR_PROP]: diagnostics,
			}
		}
	}
}

/**
 * Normalize → enrich → render for an Aero-owned failure.
 *
 * @param err - Thrown value (CompileError, CssSyntaxError, Error, …).
 * @param context - Normalize/enrich/render options (file hint, plugin, colors, …).
 * @param surface - Target presentation surface.
 */
export function reportAeroFailure(
	err: unknown,
	context: ReportAeroFailureContext,
	surface: 'vite-overlay'
): ViteOverlayRenderResult
export function reportAeroFailure(
	err: unknown,
	context: ReportAeroFailureContext,
	surface: Exclude<RenderSurface, 'vite-overlay'>
): string
export function reportAeroFailure(
	err: unknown,
	context: ReportAeroFailureContext,
	surface: RenderSurface
): RenderDiagnosticsResult {
	const { file, code, defaultFile, ...renderOptions } = context
	const normalizeCtx: NormalizeContext = {
		...(file !== undefined ? { file } : {}),
		...(code !== undefined ? { code } : {}),
	}
	const enriched = enrichDiagnostics(normalizeToDiagnostics(err, normalizeCtx), {
		...(defaultFile !== undefined ? { defaultFile } : {}),
	})
	if (surface === 'vite-overlay') {
		return renderDiagnostics(enriched, 'vite-overlay', renderOptions)
	}
	return renderDiagnostics(enriched, surface, renderOptions)
}

/** @deprecated Use {@link NormalizeContext}. */
export type ErrorContext = NormalizeContext & { code?: AeroDiagnosticCode }
