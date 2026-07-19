/**
 * Bounded concurrent prerender pool with SIGINT cancellation support.
 */

import os from 'node:os'
import { AeroBuildCancelledError } from '@aero-js/diagnostics'

/** `AERO_LOG=debug` (or comma/space-separated list including `debug`): log static build phase timings. */
export function aeroStaticBuildDebug(message: string): void {
	const v = process.env.AERO_LOG
	if (v === 'debug' || (typeof v === 'string' && v.split(/[\s,]+/).includes('debug'))) {
		console.log(`[aero] ${message}`)
	}
}

/**
 * Bounded parallelism for static prerender. Override with `AERO_STATIC_PRERENDER_CONCURRENCY` (1–64);
 * default is `min(8, availableParallelism)` (at least 1).
 */
export function resolveStaticPrerenderConcurrency(): number {
	const raw = process.env.AERO_STATIC_PRERENDER_CONCURRENCY?.trim()
	if (raw) {
		const n = Number.parseInt(raw, 10)
		if (Number.isFinite(n) && n >= 1) return Math.min(n, 64)
	}
	const cpus =
		typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length
	return Math.max(1, Math.min(8, cpus))
}

interface RunPrerenderWithCancellationArgs<T> {
	items: readonly T[]
	concurrency: number
	signal: AbortSignal
	worker: (item: T) => Promise<void>
}

export async function runPrerenderWithCancellation<T>({
	items,
	concurrency,
	signal,
	worker,
}: RunPrerenderWithCancellationArgs<T>): Promise<void> {
	try {
		let index = 0
		const poolSize = Math.max(1, Math.min(concurrency, items.length || 1))
		async function runWorker(): Promise<void> {
			while (true) {
				if (signal.aborted) {
					throw new AeroBuildCancelledError({
						message: 'Static prerender cancelled (SIGINT)',
					})
				}
				const current = index++
				if (current >= items.length) return
				await worker(items[current]!)
			}
		}
		await Promise.all(Array.from({ length: poolSize }, () => runWorker()))
	} catch (prerenderErr) {
		if (signal.aborted) {
			throw new AeroBuildCancelledError({
				message: 'Static prerender cancelled (SIGINT)',
			})
		}
		throw prerenderErr
	}
}
