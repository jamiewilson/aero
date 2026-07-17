/**
 * Dev-only: surface hypermedia infrastructure errors via Vite ErrorOverlay.
 *
 * Wired through `HypermediaRuntimeOptions.onInfrastructureError` — not DOM
 * `error` listeners (CustomEvent('error') is unreliable for document capture).
 */

import type { ViteOverlayErrorPayload } from '@aero-js/diagnostics/browser'
import { showAeroViteErrorOverlay } from './vite-error-overlay'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

function formatNitroStack(stack: unknown): string | undefined {
	if (typeof stack === 'string') return stack
	if (!Array.isArray(stack)) return undefined
	return stack
		.map(frame => {
			if (typeof frame === 'string') return frame
			if (!isRecord(frame)) return String(frame)
			const fn = typeof frame.function === 'string' ? frame.function : ''
			const file =
				typeof frame.file === 'string'
					? frame.file
					: typeof frame.source === 'string'
						? frame.source
						: ''
			const line = frame.line ?? frame.lineNumber
			const col = frame.column ?? frame.columnNumber
			const loc =
				file && line !== undefined
					? col !== undefined
						? `${file}:${line}:${col}`
						: `${file}:${line}`
					: file
			if (fn && loc) return `at ${fn} (${loc})`
			if (loc) return `at ${loc}`
			if (fn) return `at ${fn}`
			return JSON.stringify(frame)
		})
		.join('\n')
}

/** Build a Vite overlay payload from a hypermedia infrastructure `error` detail. */
export function hypermediaErrorToViteOverlay(detail: {
	response?: { status: number; html: string; headers: Record<string, string> }
	error?: Error
}): ViteOverlayErrorPayload | null {
	const response = detail.response
	if (!response) return null

	const contentType = response.headers['content-type'] ?? ''
	if (contentType.includes('application/json')) {
		try {
			const parsed = JSON.parse(response.html) as unknown
			if (isRecord(parsed)) {
				const message =
					typeof parsed.message === 'string' && parsed.message.trim()
						? parsed.message
						: `HTTP ${response.status}`
				return {
					message,
					stack: formatNitroStack(parsed.stack) ?? '',
					plugin: 'aero-hypermedia',
				}
			}
		} catch {
			/* not JSON */
		}
		return { message: `HTTP ${response.status}`, stack: '', plugin: 'aero-hypermedia' }
	}

	const fromError = detail.error?.message?.trim()
	return {
		message: fromError || `HTTP ${response.status}`,
		stack: '',
		plugin: 'aero-hypermedia',
	}
}

/** Show Vite overlay for a hypermedia infrastructure failure (no-op outside `vite dev`). */
export function showHypermediaInfrastructureErrorOverlay(detail: {
	response?: { status: number; html: string; headers: Record<string, string> }
	error?: Error
}): void {
	if (!import.meta.env.DEV) return
	const payload = hypermediaErrorToViteOverlay(detail)
	if (!payload) return
	void showAeroViteErrorOverlay({
		...payload,
		stack: payload.stack ?? '',
	}).catch(() => {
		/* Vite client may be unavailable outside `vite dev` */
	})
}
