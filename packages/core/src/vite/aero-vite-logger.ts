/**
 * Vite logger + SSR HMR logger: Aero-owned errors use the shared dev console format;
 * only suppress noisy HTML SSR parse dumps and raw Error object inspection (`pluginCode`).
 */

import type { Logger, ServerModuleRunnerOptions } from 'vite'
import {
	AERO_DIAGNOSTICS_ERROR_PROP,
	enrichDiagnostics,
	formatCondensedHtmlSsrParseError,
	frameForViteOverlay,
	isAeroOwnedFailure,
	isCondensableHtmlSsrParseError,
	normalizeToDiagnostics,
	renderDiagnostics,
	sharedDiagnosticLogGate,
	viteLoggerHasColors,
	type AeroDiagnostic,
	type DiagnosticLogGate,
} from '@aero-js/diagnostics'

/** @see import('vite/module-runner').HMRLogger */
interface HmrLoggerLike {
	error(msg: string | Error): void
	debug(...msg: unknown[]): void
}

interface ViteErrorLike {
	message: string
	stack?: string
	id?: string
	frame?: string
	plugin?: string
	loc?: { file?: string; line?: number; column?: number }
}

function asViteErrorLike(value: unknown): ViteErrorLike | undefined {
	if (typeof value !== 'object' || value === null) return undefined
	const record = value as Record<string, unknown>
	if (typeof record.message !== 'string') return undefined
	return record as unknown as ViteErrorLike
}

function shouldOwnViteError(err: ViteErrorLike, rawError: unknown): boolean {
	return isAeroOwnedFailure(rawError) || isAeroOwnedFailure(err)
}

/** Prefer diagnostics attached by {@link renderDiagnostics}(`vite-overlay`). */
function attachedAeroDiagnostics(rawError: unknown): AeroDiagnostic[] | undefined {
	if (typeof rawError !== 'object' || rawError === null) return undefined
	const attached = (rawError as Record<string, unknown>)[AERO_DIAGNOSTICS_ERROR_PROP]
	if (!Array.isArray(attached) || attached.length === 0) return undefined
	return attached as AeroDiagnostic[]
}

function diagnosticsFromViteError(err: ViteErrorLike, rawError?: unknown) {
	const attached = attachedAeroDiagnostics(rawError)
	if (attached) return enrichDiagnostics(attached)
	const source =
		rawError instanceof Error ? rawError : Object.assign(new Error(err.message), err)
	return enrichDiagnostics(normalizeToDiagnostics(source))
}

/**
 * Stamp Vite ErrorOverlay fields from pipeline `vite-overlay` render.
 * Attaches {@link AERO_DIAGNOSTICS_ERROR_PROP} only here (and in `renderDiagnostics('vite-overlay')`).
 */
function stampViteOverlayFields(rawError: unknown, diagnostics: readonly AeroDiagnostic[]): void {
	if (!(rawError instanceof Error) || diagnostics.length === 0) return
	const plugin =
		typeof (rawError as Error & { plugin?: unknown }).plugin === 'string'
			? (rawError as Error & { plugin: string }).plugin
			: undefined
	const fields = renderDiagnostics(diagnostics, 'vite-overlay', { plugin })
	const target = rawError as Error & Record<string, unknown>
	if (fields.id) target.id = fields.id
	if (fields.loc) target.loc = fields.loc
	const overlayFrame = frameForViteOverlay(fields.frame)
	if (overlayFrame) target.frame = overlayFrame
	if (fields.message) target.message = fields.message
	target[AERO_DIAGNOSTICS_ERROR_PROP] = fields[AERO_DIAGNOSTICS_ERROR_PROP]
}

function isRuntimeInstanceHmrNoise(msg: string): boolean {
	return (
		msg.includes('Failed to reload virtual:aero/runtime-instance.ts') ||
		msg.includes('hot updated: virtual:aero/runtime-instance.ts')
	)
}

/**
 * Print Aero diagnostics with the shared colored console layout; skip Vite's default string.
 * Owns Aero plugin errors and CssSyntaxError (already framed by diagnostics).
 */
export function wrapAeroViteLogger(
	base: Logger,
	gate: DiagnosticLogGate = sharedDiagnosticLogGate
): Logger {
	return {
		...base,
		error(msg: string, options) {
			const rawError = options?.error
			const err = asViteErrorLike(rawError)
			if (rawError instanceof Error && isCondensableHtmlSsrParseError(rawError)) {
				base.error(formatCondensedHtmlSsrParseError(rawError), {
					...options,
					error: rawError,
				})
				return
			}
			if (err && shouldOwnViteError(err, rawError)) {
				const diagnostics = diagnosticsFromViteError(err, rawError)
				// Always stamp before prepareError (runs after logger.error even when we skip printing).
				stampViteOverlayFields(rawError, diagnostics)
				if (!gate.shouldLog(diagnostics)) return
				// Dev console format includes its own timestamp; avoid `time [vite] time [aero]`.
				const colors = viteLoggerHasColors(base)
				base.error(
					renderDiagnostics(
						diagnostics,
						'dev-console',
						colors === undefined ? {} : { colors }
					),
					{
						...options,
						timestamp: false,
						error: rawError instanceof Error ? rawError : options?.error,
					}
				)
				return
			}
			base.error(msg, options)
		},
	}
}

/**
 * SSR module-runner HMR logger. Plugin-tagged transform errors are already printed by
 * Vite's logger - skip them here. Never dump revived Error objects (avoids `pluginCode`).
 */
export function createAeroSsrHmrLogger(): HmrLoggerLike {
	return {
		debug: (...msg: unknown[]) => {
			const text = msg.map(item => String(item)).join(' ')
			if (isRuntimeInstanceHmrNoise(text)) return
			console.log('[vite]', ...msg)
		},
		error(msg: string | Error) {
			if (typeof msg === 'string') {
				if (isRuntimeInstanceHmrNoise(msg)) return
				console.error('[vite]', msg)
				return
			}
			if (isCondensableHtmlSsrParseError(msg)) {
				console.error('[vite]\n' + formatCondensedHtmlSsrParseError(msg))
				return
			}
			const err = asViteErrorLike(msg)
			// Plugin-tagged errors are already owned by Vite's logger.
			if (err?.plugin) {
				return
			}
			console.error('[vite]', msg.stack ?? msg.message)
		},
	}
}

/**
 * Merge Aero's HMR logger with existing {@link ServerModuleRunnerOptions} unless user disabled HMR logging.
 */
export function mergeSsrRunnerOptionsWithHmrLogger(
	base: ServerModuleRunnerOptions | undefined,
	hmrLogger: HmrLoggerLike
): ServerModuleRunnerOptions {
	if (base?.hmr === false) {
		return { ...base }
	}
	const userHmr = base?.hmr && typeof base.hmr === 'object' ? base.hmr : {}
	const userLogger = userHmr.logger
	if (userLogger === false) {
		return {
			...base,
			hmr: { ...userHmr, logger: false },
		}
	}
	return {
		...base,
		hmr: {
			...userHmr,
			logger: userLogger !== undefined ? userLogger : hmrLogger,
		},
	}
}
