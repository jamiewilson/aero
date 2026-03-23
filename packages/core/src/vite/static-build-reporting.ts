import {
	AERO_EXIT_NITRO,
	AeroBuildCancelledError,
	type AeroDiagnostic,
	enrichDiagnosticsWithSourceFrames,
	exitCodeForThrown,
	formatDiagnosticsTerminal,
	unknownToAeroDiagnostics,
} from '@aero-js/diagnostics'

interface BuildLogger {
	warn(msg: string): void
	error(msg: string): void
}

type MetricsSurface = 'static-prerender' | 'static-nitro'
const metricsByCode = new Map<string, number>()
const metricsBySurface = new Map<MetricsSurface, number>()
let metricsTotal = 0

function isDebugEnabled(): boolean {
	const v = process.env.AERO_LOG
	return v === 'debug' || (typeof v === 'string' && v.split(/[\s,]+/).includes('debug'))
}

function recordDiagnosticsMetrics(surface: MetricsSurface, diagnostics: readonly AeroDiagnostic[]): void {
	if (diagnostics.length === 0) return
	metricsTotal += diagnostics.length
	metricsBySurface.set(surface, (metricsBySurface.get(surface) ?? 0) + diagnostics.length)
	for (const d of diagnostics) {
		metricsByCode.set(d.code, (metricsByCode.get(d.code) ?? 0) + 1)
	}
	if (isDebugEnabled()) {
		loggerDebug(
			`metrics[${surface}] +${diagnostics.length} diagnostics (total=${metricsTotal}) ` +
				`codes=${diagnostics.map(d => d.code).join(',')}`
		)
	}
}

function loggerDebug(message: string): void {
	if (!isDebugEnabled()) return
	console.error(`[aero] ${message}`)
}

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

