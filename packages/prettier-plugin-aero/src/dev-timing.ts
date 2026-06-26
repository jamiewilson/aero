import { performance } from 'node:perf_hooks'

/** True when `AERO_PRETTIER_LOG` is `debug` or includes `debug`. */
export function isAeroPrettierDebugEnabled(): boolean {
	const v = process.env.AERO_PRETTIER_LOG
	return v === 'debug' || (typeof v === 'string' && v.split(/[\s,]+/).includes('debug'))
}

/** Log a preprocess phase timing line when debug logging is enabled. */
export function logAeroPrettierTiming(scope: string, startMs: number, detail?: string): void {
	if (!isAeroPrettierDebugEnabled()) return
	const ms = performance.now() - startMs
	const suffix = detail ? ` ${detail}` : ''
	console.error(`[aero] timing[prettier-${scope}] ${ms.toFixed(1)}ms${suffix}`)
}
