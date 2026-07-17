import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import consola from 'consola'
import { definePlugin } from 'nitro'
import { getRequestURL, HTTPError } from 'nitro/h3'
import type { HTTPEvent } from 'nitro/h3'

/**
 * Whether Aero should print youch for this Nitro `error` hook invocation.
 *
 * Nitro already logs unhandled throws. Intentional `HTTPError`s with status >= 500
 * are otherwise silent — Aero logs those for request-error parity in the terminal.
 * Client errors (4xx) stay silent so intentional HTML fragments (e.g. 422) are unaffected.
 */
export function shouldLogIntentionalHttpError(
	error: unknown,
	event: HTTPEvent | undefined
): error is Error {
	if ((error as { unhandled?: boolean }).unhandled) return false
	if (!event || !HTTPError.isError(error)) return false
	if (error.status === 404 || error.status < 500) return false
	return true
}

/** Same terminal formatting Nitro uses for unhandled errors (youch + consola). */
async function logRequestErrorLikeNitro(error: Error, event: HTTPEvent): Promise<void> {
	const url = getRequestURL(event)
	await enrichStackForYouch(error).catch(() => {})
	const { Youch } = await import('youch')
	const ansi = (await new Youch().toANSI(error)).replaceAll(process.cwd(), '.')
	consola.error(`[request error] [${event.req.method}] ${url}\n\n`, ansi)
}

/**
 * Mirror Nitro's loadStackTrace (including source-map remapping) so youch can
 * show source code frames for intentional HTTPErrors.
 */
async function enrichStackForYouch(error: Error): Promise<void> {
	const { ErrorParser } = await import('youch-core')
	const parsed = await new ErrorParser()
		.defineSourceLoader(async frame => {
			if (!frame.fileName || frame.fileType !== 'fs' || frame.type === 'native') return
			if (frame.type === 'app') {
				const rawSourceMap = await readFile(`${frame.fileName}.map`, 'utf8').catch(() => {})
				if (rawSourceMap) {
					const { SourceMapConsumer } = await import('source-map')
					const consumer = await new SourceMapConsumer(rawSourceMap)
					const originalPosition = consumer.originalPositionFor({
						line: frame.lineNumber!,
						column: frame.columnNumber!,
					})
					if (originalPosition.source && originalPosition.line) {
						frame.fileName = resolve(dirname(frame.fileName), originalPosition.source)
						frame.lineNumber = originalPosition.line
						frame.columnNumber = originalPosition.column || 0
					}
				}
			}
			const contents = await readFile(frame.fileName, 'utf8').catch(() => undefined)
			return contents ? { contents } : undefined
		})
		.parse(error)

	const stack =
		error.message +
		'\n' +
		parsed.frames
			.map(frame => {
				if (frame.type === 'native') return frame.raw
				const src = `${frame.fileName || ''}:${frame.lineNumber}:${frame.columnNumber})`
				return frame.functionName ? `at ${frame.functionName} (${src}` : `at ${src}`
			})
			.join('\n')

	Object.defineProperty(error, 'stack', { value: stack })
	if (error.cause instanceof Error) {
		await enrichStackForYouch(error.cause).catch(() => {})
	}
}

/**
 * Aero Nitro invariant plugin: response marker + intentional HTTPError terminal logs.
 */
export default definePlugin(nitroApp => {
	nitroApp.hooks.hook('response', response => {
		response.headers.set('x-aero-nitro', 'true')
	})

	nitroApp.hooks.hook('error', (error, { event }) => {
		if (!shouldLogIntentionalHttpError(error, event) || !event) return
		void logRequestErrorLikeNitro(error, event)
	})
})
