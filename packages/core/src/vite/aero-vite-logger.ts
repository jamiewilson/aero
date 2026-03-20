/**
 * Vite logger + SSR module-runner HMR logger: condense noisy Rolldown HTML parse errors.
 */

import type { Logger, ServerModuleRunnerOptions } from 'vite'
import {
	formatCondensedHtmlSsrParseError,
	isCondensableHtmlSsrParseError,
} from './condense-ssr-parse-error'

/** @see import('vite/module-runner').HMRLogger */
export interface HMRLoggerLike {
	error(msg: string | Error): void
	debug(...msg: unknown[]): void
}

export function wrapAeroViteLogger(base: Logger): Logger {
	return {
		...base,
		error(msg: string, options) {
			const err = options?.error
			if (err instanceof Error && isCondensableHtmlSsrParseError(err)) {
				base.error(formatCondensedHtmlSsrParseError(err), {
					...options,
					error: err,
				})
				return
			}
			base.error(msg, options)
		},
	}
}

export function createAeroSsrHmrLogger(): HMRLoggerLike {
	return {
		debug: (...msg: unknown[]) => console.log('[vite]', ...msg),
		error(msg: string | Error) {
			if (typeof msg === 'string') {
				console.error('[vite]', msg)
				return
			}
			if (isCondensableHtmlSsrParseError(msg)) {
				console.error('[vite]\n' + formatCondensedHtmlSsrParseError(msg))
				return
			}
			console.error('[vite]', msg)
		},
	}
}

/**
 * Merge Aero's HMR logger with existing {@link ServerModuleRunnerOptions} unless user disabled HMR logging.
 */
export function mergeSsrRunnerOptionsWithHmrLogger(
	base: ServerModuleRunnerOptions | undefined,
	hmrLogger: HMRLoggerLike,
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
