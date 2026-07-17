import {
	AERO_EXIT_BUILD_GENERIC,
	AERO_EXIT_NITRO,
	AeroBuildCancelledError,
	AeroCompileError,
	type AeroDiagnostic,
	type DiagnosticsSurface,
	enrichDiagnostics,
	exitCodeForThrown,
	normalizeToDiagnostics,
	recordDiagnosticsMetrics,
	renderDiagnostics,
} from '@aero-js/diagnostics'

interface BuildLogger {
	warn(msg: string): void
	error(msg: string): void
}

type MetricsSurface = Extract<DiagnosticsSurface, 'static-prerender' | 'static-nitro'>

export interface StaticBuildReportingService {
	reportPrerenderFailure(err: unknown, logger: BuildLogger): never
	reportNitroFailure(err: unknown, logger: BuildLogger): never
}

interface StaticBuildReportingOptions {
	recordMetrics?: (surface: MetricsSurface, diagnostics: readonly AeroDiagnostic[]) => void
}

function isAeroOwnedError(err: unknown): boolean {
	if (err instanceof AeroCompileError) return true
	if (!(err instanceof Error)) return false
	if (/^\[AERO_[A-Z_]+\]/.test(err.message)) return true
	const plugin = (err as Error & { plugin?: unknown }).plugin
	return typeof plugin === 'string' && plugin.includes('aero')
}

export function createStaticBuildReportingService(
	options: StaticBuildReportingOptions = {}
): StaticBuildReportingService {
	const recordMetrics = options.recordMetrics ?? recordDiagnosticsMetrics
	return {
		reportPrerenderFailure(err: unknown, logger: BuildLogger): never {
			if (err instanceof AeroBuildCancelledError) {
				logger.warn(`[aero] ${err.message ?? 'Static build cancelled'}`)
				process.exitCode = exitCodeForThrown(err)
				throw err
			}
			if (isAeroOwnedError(err)) {
				const diagnostics = enrichDiagnostics(normalizeToDiagnostics(err))
				recordMetrics('static-prerender', diagnostics)
				logger.error('\n' + renderDiagnostics(diagnostics, 'terminal') + '\n')
				process.exitCode = exitCodeForThrown(err)
				throw err
			}
			const message = err instanceof Error ? (err.stack ?? err.message) : String(err)
			logger.error(message)
			process.exitCode = AERO_EXIT_BUILD_GENERIC
			throw err
		},
		reportNitroFailure(err: unknown, logger: BuildLogger): never {
			const message = err instanceof Error ? (err.stack ?? err.message) : String(err)
			logger.error(message)
			process.exitCode = AERO_EXIT_NITRO
			throw err
		},
	}
}
