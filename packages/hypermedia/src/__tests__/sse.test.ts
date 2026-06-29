import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
	AERO_SSE_PATCH_ELEMENTS,
	AERO_SSE_PATCH_SIGNALS,
	formatSseEvent,
	isEventStreamContentType,
	parseElementsPatchData,
	parseSseMessage,
	readSseStream,
	runSseSession,
	shouldHandleSseEvent,
} from '../sse'

describe('parseSseMessage', () => {
	it('parses named events with data payloads', () => {
		const block = 'event: aero-patch-elements\ndata: {"target":"#x","html":"<p>ok</p>"}'
		expect(parseSseMessage(block)).toEqual({
			event: 'aero-patch-elements',
			data: '{"target":"#x","html":"<p>ok</p>"}',
		})
	})

	it('joins multi-line data fields', () => {
		const block = 'event: aero-patch-signals\ndata: {\ndata: "count":1}'
		expect(parseSseMessage(block)?.data).toBe('{\n"count":1}')
	})
})

describe('shouldHandleSseEvent', () => {
	it('accepts Aero patch events only', () => {
		expect(shouldHandleSseEvent(AERO_SSE_PATCH_ELEMENTS)).toBe(true)
		expect(shouldHandleSseEvent(AERO_SSE_PATCH_SIGNALS)).toBe(true)
		expect(shouldHandleSseEvent('datastar-patch-elements')).toBe(false)
		expect(shouldHandleSseEvent('datastar-patch-signals')).toBe(false)
	})
})

describe('parseElementsPatchData', () => {
	it('parses single and batched element patches', () => {
		expect(
			parseElementsPatchData('{"target":"#a","html":"<p>a</p>","swap":"innerHTML"}')
		).toEqual([{ target: '#a', html: '<p>a</p>', swap: 'innerHTML' }])
		expect(
			parseElementsPatchData(
				'{"patches":[{"target":"#a","html":"a"},{"target":"#b","html":"b"}]}'
			)
		).toHaveLength(2)
	})
})

describe('formatSseEvent', () => {
	it('formats server-side SSE frames', () => {
		expect(formatSseEvent('aero-patch-signals', '{"count":1}')).toBe(
			'event: aero-patch-signals\ndata: {"count":1}\n\n'
		)
	})
})

describe('isEventStreamContentType', () => {
	it('detects text/event-stream responses', () => {
		expect(isEventStreamContentType('text/event-stream')).toBe(true)
		expect(isEventStreamContentType('text/event-stream; charset=utf-8')).toBe(true)
		expect(isEventStreamContentType('text/html')).toBe(false)
	})
})

describe('readSseStream', () => {
	it('dispatches parsed events from a readable stream', async () => {
		const payload = formatSseEvent(
			AERO_SSE_PATCH_ELEMENTS,
			'{"target":"#result","html":"<span>live</span>"}'
		)
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(payload))
				controller.close()
			},
		})
		const events: string[] = []
		await readSseStream(stream, (event, data) => {
			events.push(`${event}:${data}`)
		})
		expect(events).toHaveLength(1)
	})
})

describe('runSseSession', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('reconnects with backoff after stream errors', async () => {
		const open = vi
			.fn()
			.mockRejectedValueOnce(new TypeError('network'))
			.mockResolvedValueOnce(
				new Response(formatSseEvent(AERO_SSE_PATCH_SIGNALS, '{"count":2}'), {
					status: 200,
					headers: { 'Content-Type': 'text/event-stream' },
				})
			)
		const onSignalsPatch = vi.fn()
		const session = runSseSession({
			open,
			baseBackoffMs: 100,
			reactivity: true,
			handlers: { onElementsPatch: () => {}, onSignalsPatch },
		})

		await vi.advanceTimersByTimeAsync(100)
		await session
		expect(open).toHaveBeenCalledTimes(2)
		expect(onSignalsPatch).toHaveBeenCalledWith({ count: 2 })
	})

	it('stops cleanly when aborted', async () => {
		const controller = new AbortController()
		const open = vi.fn().mockImplementation(
			() =>
				new Promise<Response>(() => {
					/* pending */
				})
		)
		const session = runSseSession({
			open,
			signal: controller.signal,
			handlers: { onElementsPatch: () => {} },
		})
		controller.abort()
		await session
		expect(open).toHaveBeenCalledTimes(1)
	})
})
