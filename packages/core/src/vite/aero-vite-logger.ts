/**
 * Vite logger + SSR HMR logger: keep Vite's default console format; only suppress
 * noisy HTML SSR parse dumps and raw Error object inspection (`pluginCode`).
 */

import type { Logger, ServerModuleRunnerOptions } from 'vite'
import {
	createDiagnosticLogGate,
	enrichDiagnosticsWithSourceFrames,
	formatCondensedHtmlSsrParseError,
	isCondensableHtmlSsrParseError,
	unknownToAeroDiagnostics,
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

const defaultGate = createDiagnosticLogGate()

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

function shouldLogAeroViteError(err: ViteErrorLike, gate: DiagnosticLogGate): boolean {
	const diagnostics = enrichDiagnosticsWithSourceFrames(
		unknownToAeroDiagnostics(Object.assign(new Error(err.message), err))
	)
	return gate.shouldLog(diagnostics)
}

function isRuntimeInstanceHmrNoise(msg: string): boolean {
	return (
		msg.includes('Failed to reload virtual:aero/runtime-instance.ts') ||
		msg.includes('hot updated: virtual:aero/runtime-instance.ts')
	)
}

/**
 * Pass through Vite's default error formatting. Only rewrite condensable HTML SSR parse noise.
 */
export function wrapAeroViteLogger(base: Logger, gate: DiagnosticLogGate = defaultGate): Logger {
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
			if (err && isAeroViteError(err) && !shouldLogAeroViteError(err, gate)) {
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
