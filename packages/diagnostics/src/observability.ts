import type { AeroDiagnostic, AeroDiagnosticCode } from './types'

export type DiagnosticsSurface =
	| 'cli-check'
	| 'static-prerender'
	| 'static-nitro'
	| 'dev-ssr'
	| 'vite-compile'
	| 'content-load'

export interface DiagnosticsMetricsSnapshot {
	total: number
	byCode: Partial<Record<AeroDiagnosticCode, number>>
	bySurface: Partial<Record<DiagnosticsSurface, number>>
}

const byCode: Partial<Record<AeroDiagnosticCode, number>> = {}
const bySurface: Partial<Record<DiagnosticsSurface, number>> = {}
let total = 0

function isDebugEnabled(): boolean {
	const v = process.env.AERO_LOG
	return v === 'debug' || (typeof v === 'string' && v.split(/[\s,]+/).includes('debug'))
}

function debugLog(message: string): void {
	if (!isDebugEnabled()) return
	console.error(`[aero] ${message}`)
}

export function recordDiagnosticsMetrics(
	surface: DiagnosticsSurface,
	diagnostics: readonly AeroDiagnostic[]
): void {
	if (diagnostics.length === 0) return
	total += diagnostics.length
	bySurface[surface] = (bySurface[surface] ?? 0) + diagnostics.length
	for (const d of diagnostics) {
		byCode[d.code] = (byCode[d.code] ?? 0) + 1
	}
	debugLog(
		`metrics[${surface}] +${diagnostics.length} diagnostics (total=${total}) ` +
			`codes=${diagnostics.map(d => d.code).join(',')}`
	)
}

export function getDiagnosticsMetricsSnapshot(): DiagnosticsMetricsSnapshot {
	return {
		total,
		byCode: { ...byCode },
		bySurface: { ...bySurface },
	}
}

export function resetDiagnosticsMetrics(): void {
	total = 0
	for (const key of Object.keys(byCode) as AeroDiagnosticCode[]) delete byCode[key]
	for (const key of Object.keys(bySurface) as DiagnosticsSurface[]) delete bySurface[key]
}

export interface DebugSpan {
	end(details?: string): void
}

export function startDebugSpan(name: string): DebugSpan {
	const t0 = Date.now()
	debugLog(`span:start ${name}`)
	return {
		end(details?: string): void {
			const dt = Date.now() - t0
			debugLog(`span:end ${name} (${dt}ms${details ? `, ${details}` : ''})`)
		},
	}
}

