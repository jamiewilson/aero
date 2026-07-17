import { readFile } from 'node:fs/promises'
import consola from 'consola'
import { definePlugin } from 'nitro'
import { getRequestURL, HTTPError } from 'nitro/h3'
import type { HTTPEvent } from 'nitro/h3'
import { Youch } from 'youch'
import { ErrorParser } from 'youch-core'

/**
 * Same terminal formatting Nitro uses for unhandled errors (youch + consola),
 * applied to intentional HTTPError responses that Nitro otherwise silences.
 */
async function logRequestErrorLikeNitro(error: Error, event: HTTPEvent): Promise<void> {
	const url = getRequestURL(event)
	await enrichStackForYouch(error).catch(() => {})
	const ansi = (await new Youch().toANSI(error)).replaceAll(process.cwd(), '.')
	consola.error(`[request error] [${event.req.method}] ${url}\n\n`, ansi)
}

/** Mirror Nitro's loadStackTrace so youch can show source frames. */
async function enrichStackForYouch(error: Error): Promise<void> {
	const parsed = await new ErrorParser()
		.defineSourceLoader(async frame => {
			if (!frame.fileName || frame.fileType !== 'fs' || frame.type === 'native') return
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

export default definePlugin(nitroApp => {
	nitroApp.hooks.hook('response', response => {
		response.headers.set('x-aero-nitro', 'true')
	})

	nitroApp.hooks.hook('error', (error, { event }) => {
		// Unhandled throws: Nitro's default error handler already prints youch.
		if ((error as { unhandled?: boolean }).unhandled) return
		if (!event || !HTTPError.isError(error) || error.status === 404) return

		void logRequestErrorLikeNitro(error, event)
	})
})
