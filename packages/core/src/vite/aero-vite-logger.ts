/**
 * Vite logger + SSR HMR logger: Aero-owned errors use the shared dev console format;
 * only suppress noisy HTML SSR parse dumps and raw Error object inspection (`pluginCode`).
 */

import type { Logger, ServerModuleRunnerOptions } from 'vite'
import {
	aeroDiagnosticToViteErrorFields,
	enrichDiagnosticsWithSourceFrames,
	formatCondensedHtmlSsrParseError,
	formatDiagnosticsDevConsole,
	frameForViteOverlay,
	isCondensableHtmlSsrParseError,
	sharedDiagnosticLogGate,
	unknownToAeroDiagnostics,
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

function isAeroViteError(err: ViteErrorLike): boolean {
	const plugin = err.plugin
	return (
		(typeof plugin === 'string' && plugin.includes('aero')) || /^\[AERO_[A-Z_]+\]/.test(err.message)
	)
}

/** CSS syntax errors Aero already maps to file + frame diagnostics. */
function isCssSyntaxError(value: unknown): boolean {
	return value instanceof Error && value.name === 'CssSyntaxError'
}

function shouldOwnViteError(err: ViteErrorLike, rawError: unknown): boolean {
	return isAeroViteError(err) || isCssSyntaxError(rawError)
}

function diagnosticsFromViteError(err: ViteErrorLike, rawError?: unknown) {
	const source =
		rawError instanceof Error ? rawError : Object.assign(new Error(err.message), err)
	return enrichDiagnosticsWithSourceFrames(unknownToAeroDiagnostics(source))
}

/**
 * Vite's `prepareError` / ErrorOverlay read `frame`/`id`/`loc` from the raw error after
 * `logger.error`. Stamp Aero-enriched fields so the overlay matches the console frame.
 */
function stampViteOverlayFields(rawError: unknown, diagnostics: readonly AeroDiagnostic[]): void {
	if (!(rawError instanceof Error) || diagnostics.length === 0) return
	const d0 = diagnostics[0]!
	const plugin =
		typeof (rawError as Error & { plugin?: unknown }).plugin === 'string'
			? (rawError as Error & { plugin: string }).plugin
			: undefined
	const fields = aeroDiagnosticToViteErrorFields(d0, plugin)
	const target = rawError as Error & Record<string, unknown>
	if (fields.id) target.id = fields.id
	if (fields.loc) target.loc = fields.loc
	const overlayFrame = frameForViteOverlay(fields.frame)
	if (overlayFrame) target.frame = overlayFrame
	if (fields.message) target.message = fields.message
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
				base.error(formatDiagnosticsDevConsole(diagnostics, { colors: base.hasColors }), {
					...options,
					timestamp: false,
					error: rawError instanceof Error ? rawError : options?.error,
				})
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
