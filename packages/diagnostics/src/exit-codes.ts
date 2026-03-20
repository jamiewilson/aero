/**
 * Distinct `process.exitCode` values when static prerender / build fails (for CI scripts).
 * Vite/Rollup may still exit non-zero; this adds a coarse category for automation.
 */

import type { AeroDiagnostic } from './types'
import { unknownToAeroDiagnostics } from './from-unknown'

/** Config load or validation (reserved — use when errors map to `AERO_CONFIG`). */
export const AERO_EXIT_CONFIG = 10

/** Generic build / prerender failure (unknown or internal). */
export const AERO_EXIT_BUILD_GENERIC = 11

/** Compile, parse, resolve, or build-script diagnostics. */
export const AERO_EXIT_COMPILE = 12

/** Content schema / collection validation. */
export const AERO_EXIT_CONTENT = 13

/** Routing / getStaticPaths mismatch (dev runtime or prerender resolution). */
export const AERO_EXIT_ROUTE = 14

/** Nitro server bundle step failed after static HTML. */
export const AERO_EXIT_NITRO = 15

/**
 * Map the primary diagnostic code to an exit code bucket.
 *
 * @param diagnostics - Non-empty list from {@link unknownToAeroDiagnostics} or similar.
 */
export function exitCodeForDiagnostics(diagnostics: readonly AeroDiagnostic[]): number {
	const code = diagnostics[0]?.code
	switch (code) {
		case 'AERO_CONFIG':
			return AERO_EXIT_CONFIG
		case 'AERO_CONTENT_SCHEMA':
			return AERO_EXIT_CONTENT
		case 'AERO_COMPILE':
		case 'AERO_PARSE':
		case 'AERO_RESOLVE':
		case 'AERO_BUILD_SCRIPT':
			return AERO_EXIT_COMPILE
		case 'AERO_ROUTE':
			return AERO_EXIT_ROUTE
		default:
			return AERO_EXIT_BUILD_GENERIC
	}
}

/** Convenience: normalize any thrown value, then derive exit code. */
export function exitCodeForThrown(err: unknown): number {
	return exitCodeForDiagnostics(unknownToAeroDiagnostics(err))
}
