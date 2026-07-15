/**
 * Fingerprints and short-lived gates so one diagnostic is not printed by every Vite surface.
 */

import type { AeroDiagnostic } from './types'
import { stripAeroViteMessageDecorations } from './vite-error'

/** Stable identity for one diagnostic across Vite logger / SSR / HMR surfaces. */
export function diagnosticFingerprint(d: AeroDiagnostic): string {
	const { message } = stripAeroViteMessageDecorations(d.message)
	const file = d.span?.file || d.file || ''
	const line = d.span?.line ?? ''
	const column = d.span?.column ?? ''
	return `${d.code}\0${file}\0${line}\0${column}\0${message}`
}

export function diagnosticsFingerprint(diagnostics: readonly AeroDiagnostic[]): string {
	return diagnostics.map(diagnosticFingerprint).join('\n')
}

export interface DiagnosticLogGate {
	/** Returns true the first time this fingerprint is seen within the TTL window. */
	shouldLog(diagnostics: readonly AeroDiagnostic[]): boolean
	reset(): void
}

export interface CreateDiagnosticLogGateOptions {
	/** How long identical diagnostics stay suppressed. Default 5000ms. */
	ttlMs?: number
}

/**
 * Process-local (or injected) gate for collapsing duplicate terminal reports of the same error.
 */
export function createDiagnosticLogGate(
	options: CreateDiagnosticLogGateOptions = {}
): DiagnosticLogGate {
	const ttlMs = options.ttlMs ?? 5000
	const seen = new Map<string, number>()

	function prune(now: number): void {
		for (const [key, at] of seen) {
			if (now - at > ttlMs) seen.delete(key)
		}
	}

	return {
		shouldLog(diagnostics: readonly AeroDiagnostic[]): boolean {
			if (diagnostics.length === 0) return false
			const now = Date.now()
			prune(now)
			const key = diagnosticsFingerprint(diagnostics)
			if (seen.has(key)) return false
			seen.set(key, now)
			return true
		},
		reset() {
			seen.clear()
		},
	}
}
