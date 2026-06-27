import { performance } from 'node:perf_hooks'

/** True when `AERO_LOG` is `debug` or includes `debug` in a comma/space-separated list. */
export function isAeroDebugLogEnabled(): boolean {
	const v = process.env.AERO_LOG
	return v === 'debug' || (typeof v === 'string' && v.split(/[\s,]+/).includes('debug'))
}

/** Log a dev timing line when debug logging is enabled. */
export function logAeroDevTiming(
	scope: string,
	startMs: number,
	detail?: string
): void {
	if (!isAeroDebugLogEnabled()) return
	const ms = performance.now() - startMs
	const suffix = detail ? ` ${detail}` : ''
	console.error(`[aero] timing[${scope}] ${ms.toFixed(1)}ms${suffix}`)
}
