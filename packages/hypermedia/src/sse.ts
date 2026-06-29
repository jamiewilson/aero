import type { SwapStyle } from './types'
import { parseSignalPatch } from './signal-patch'

export const AERO_SSE_PATCH_ELEMENTS = 'aero-patch-elements'
export const AERO_SSE_PATCH_SIGNALS = 'aero-patch-signals'

const IGNORED_SSE_EVENTS = new Set(['datastar-patch-elements', 'datastar-patch-signals'])

export interface SseElementPatch {
	readonly target: string
	readonly html: string
	readonly swap?: SwapStyle
	readonly select?: string
}

export interface SseSessionHandlers {
	readonly onElementsPatch: (patches: readonly SseElementPatch[]) => void | Promise<void>
	readonly onSignalsPatch?: (patch: Record<string, unknown>) => void | Promise<void>
}

export interface SseSessionOptions {
	readonly open: () => Promise<Response>
	readonly signal?: AbortSignal
	readonly openWhenHidden?: boolean
	readonly reactivity?: boolean
	readonly maxReconnectAttempts?: number
	readonly baseBackoffMs?: number
	readonly maxBackoffMs?: number
	readonly handlers: SseSessionHandlers
}

export function isEventStreamContentType(contentType: string | undefined): boolean {
	return (contentType ?? '').toLowerCase().includes('text/event-stream')
}

export function parseSseMessage(block: string): { event: string; data: string } | null {
	const lines = block.split('\n')
	let event = 'message'
	const dataLines: string[] = []

	for (const line of lines) {
		if (!line || line.startsWith(':')) continue
		if (line.startsWith('event:')) {
			event = line.slice('event:'.length).trim()
			continue
		}
		if (line.startsWith('data:')) {
			dataLines.push(line.slice('data:'.length).trimStart())
		}
	}

	if (dataLines.length === 0) return null
	return { event, data: dataLines.join('\n') }
}

export function shouldHandleSseEvent(event: string): boolean {
	if (IGNORED_SSE_EVENTS.has(event)) return false
	return event === AERO_SSE_PATCH_ELEMENTS || event === AERO_SSE_PATCH_SIGNALS
}

export function parseElementsPatchData(data: string): SseElementPatch[] {
	let parsed: unknown
	try {
		parsed = JSON.parse(data)
	} catch {
		return []
	}
	if (Array.isArray(parsed)) {
		return parsed.filter(isElementPatch).map(normalizeElementPatch)
	}
	if (parsed && typeof parsed === 'object') {
		const record = parsed as Record<string, unknown>
		if (Array.isArray(record.patches)) {
			return record.patches.filter(isElementPatch).map(normalizeElementPatch)
		}
		if (isElementPatch(record)) return [normalizeElementPatch(record)]
	}
	return []
}

function isElementPatch(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === 'object' &&
		value != null &&
		typeof (value as { target?: unknown }).target === 'string' &&
		typeof (value as { html?: unknown }).html === 'string'
	)
}

function normalizeElementPatch(value: Record<string, unknown>): SseElementPatch {
	return {
		target: String(value.target),
		html: String(value.html),
		swap: typeof value.swap === 'string' ? (value.swap as SwapStyle) : undefined,
		select: typeof value.select === 'string' ? value.select : undefined,
	}
}

export function formatSseEvent(event: string, data: string): string {
	const dataLines = data.split('\n').map(line => `data: ${line}`)
	return `event: ${event}\n${dataLines.join('\n')}\n\n`
}

function backoffMs(attempt: number, base: number, max: number): number {
	return Math.min(max, base * 2 ** attempt)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	if (ms <= 0) return Promise.resolve()
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			cleanup()
			resolve()
		}, ms)
		const onAbort = () => {
			cleanup()
			reject(new DOMException('Aborted', 'AbortError'))
		}
		const cleanup = () => {
			clearTimeout(timer)
			signal?.removeEventListener('abort', onAbort)
		}
		signal?.addEventListener('abort', onAbort, { once: true })
	})
}

async function waitUntilVisible(signal?: AbortSignal, openWhenHidden = true): Promise<void> {
	if (openWhenHidden || typeof document === 'undefined' || document.visibilityState === 'visible') {
		return
	}
	await new Promise<void>((resolve, reject) => {
		const onVisible = () => {
			if (document.visibilityState === 'visible') {
				cleanup()
				resolve()
			}
		}
		const onAbort = () => {
			cleanup()
			reject(new DOMException('Aborted', 'AbortError'))
		}
		const cleanup = () => {
			document.removeEventListener('visibilitychange', onVisible)
			signal?.removeEventListener('abort', onAbort)
		}
		document.addEventListener('visibilitychange', onVisible)
		signal?.addEventListener('abort', onAbort, { once: true })
	})
}

export type SseStreamResult = 'complete' | 'aborted' | 'error'

export async function readSseStream(
	stream: ReadableStream<Uint8Array>,
	onMessage: (event: string, data: string) => void | Promise<void>,
	signal?: AbortSignal
): Promise<SseStreamResult> {
	const reader = stream.getReader()
	const decoder = new TextDecoder()
	let buffer = ''

	try {
		while (true) {
			if (signal?.aborted) return 'aborted'
			const { done, value } = await reader.read()
			if (done) return 'complete'
			buffer += decoder.decode(value, { stream: true })

			let separator = buffer.indexOf('\n\n')
			while (separator !== -1) {
				const block = buffer.slice(0, separator)
				buffer = buffer.slice(separator + 2)
				const message = parseSseMessage(block)
				if (message) await onMessage(message.event, message.data)
				separator = buffer.indexOf('\n\n')
			}
		}
	} catch {
		if (signal?.aborted) return 'aborted'
		return 'error'
	} finally {
		reader.releaseLock()
	}
}

export async function handleSseMessage(
	event: string,
	data: string,
	handlers: SseSessionHandlers,
	reactivity: boolean
): Promise<void> {
	if (!shouldHandleSseEvent(event)) return
	if (event === AERO_SSE_PATCH_ELEMENTS) {
		const patches = parseElementsPatchData(data)
		if (patches.length > 0) await handlers.onElementsPatch(patches)
		return
	}
	if (event === AERO_SSE_PATCH_SIGNALS && reactivity && handlers.onSignalsPatch) {
		const patch = parseSignalPatch(data)
		if (patch) handlers.onSignalsPatch(patch)
	}
}

function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
	if (!signal) return promise
	if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
	return new Promise<T>((resolve, reject) => {
		const onAbort = () => {
			cleanup()
			reject(new DOMException('Aborted', 'AbortError'))
		}
		const cleanup = () => {
			signal.removeEventListener('abort', onAbort)
		}
		signal.addEventListener('abort', onAbort, { once: true })
		promise.then(
			value => {
				cleanup()
				resolve(value)
			},
			error => {
				cleanup()
				reject(error)
			}
		)
	})
}

export async function runSseSession(options: SseSessionOptions): Promise<void> {
	const {
		open,
		signal,
		openWhenHidden = true,
		reactivity = false,
		maxReconnectAttempts = 10,
		baseBackoffMs = 500,
		maxBackoffMs = 30_000,
		handlers,
	} = options

	let reconnectAttempt = 0

	while (!signal?.aborted) {
		await waitUntilVisible(signal, openWhenHidden)

		let response: Response
		try {
			response = await abortable(open(), signal)
		} catch (error) {
			if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) return
			if (reconnectAttempt >= maxReconnectAttempts) throw error
			await sleep(backoffMs(reconnectAttempt++, baseBackoffMs, maxBackoffMs), signal)
			continue
		}

		if (!response.ok || !response.body) {
			if (reconnectAttempt >= maxReconnectAttempts) {
				throw new Error(`[aero] SSE connection failed with status ${response.status}.`)
			}
			await sleep(backoffMs(reconnectAttempt++, baseBackoffMs, maxBackoffMs), signal)
			continue
		}

		reconnectAttempt = 0
		const result = await readSseStream(
			response.body,
			(event, data) => handleSseMessage(event, data, handlers, reactivity),
			signal
		)

		if (result === 'aborted') return
		if (result === 'complete') return
		if (reconnectAttempt >= maxReconnectAttempts) return
		await sleep(backoffMs(reconnectAttempt++, baseBackoffMs, maxBackoffMs), signal)
	}
}
