import {
	AERO_EXIT_NITRO,
	AeroBuildCancelledError,
	type AeroDiagnostic,
	type DiagnosticsSurface,
	enrichDiagnosticsWithSourceFrames,
	exitCodeForThrown,
	formatDiagnosticsTerminal,
	recordDiagnosticsMetrics,
	unknownToAeroDiagnostics,
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
			const diagnostics = enrichDiagnosticsWithSourceFrames(unknownToAeroDiagnostics(err))
			recordMetrics('static-prerender', diagnostics)
			logger.error('\n' + formatDiagnosticsTerminal(diagnostics) + '\n')
			process.exitCode = exitCodeForThrown(err)
			throw err
		},
		reportNitroFailure(err: unknown, logger: BuildLogger): never {
			const diagnostics = enrichDiagnosticsWithSourceFrames(unknownToAeroDiagnostics(err))
			recordMetrics('static-nitro', diagnostics)
			logger.error('\n' + formatDiagnosticsTerminal(diagnostics) + '\n')
			process.exitCode = AERO_EXIT_NITRO
			throw err
		},
	}
}
