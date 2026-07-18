/**
 * Ownership gates for Aero-owned failures (logger, static build, SSR).
 */

import { AeroCompileError } from './tagged-errors'

function pluginLooksAero(plugin: unknown): boolean {
	return typeof plugin === 'string' && plugin.includes('aero')
}

function messageLooksAero(message: unknown): boolean {
	return typeof message === 'string' && /^\[AERO_[A-Z_]+\]/.test(message)
}

/**
 * Whether a thrown value should be formatted via the Aero diagnostics pipeline
 * rather than Vite/Node's default error dump.
 *
 * @remarks
 * Accepts real `Error` instances and Vite's plain error-shaped payloads (`{ message, plugin, … }`).
 */
export function isAeroOwnedFailure(err: unknown): boolean {
	if (err instanceof AeroCompileError) return true
	if (err instanceof Error) {
		if (err.name === 'CssSyntaxError') return true
		if (messageLooksAero(err.message)) return true
		return pluginLooksAero((err as Error & { plugin?: unknown }).plugin)
	}
	if (typeof err === 'object' && err !== null) {
		const record = err as Record<string, unknown>
		return pluginLooksAero(record.plugin) || messageLooksAero(record.message)
	}
	return false
}

/**
 * Vite loggers may expose `hasColors`. Only forward an explicit boolean;
 * otherwise leave formatter defaults (TTY / `NO_COLOR`).
 */
export function viteLoggerHasColors(logger: { hasColors?: unknown }): boolean | undefined {
	return typeof logger.hasColors === 'boolean' ? logger.hasColors : undefined
}
