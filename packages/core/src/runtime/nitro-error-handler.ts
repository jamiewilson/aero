import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineErrorHandler } from 'nitro'
import { HTTPError, getRequestURL } from 'nitro/h3'
import { renderAeroError } from './render-error'
import type { AeroErrorContext } from '../types'

function getProjectRoot(): string {
	const mainUrl = (globalThis as unknown as { __nitro_main__?: string }).__nitro_main__
	if (typeof mainUrl === 'string') {
		const entryDir = path.dirname(fileURLToPath(mainUrl))
		return path.resolve(entryDir, '..', '..')
	}
	return process.cwd()
}

function getDistDir(root: string): string {
	const fromEnv = process.env.AERO_DIST
	if (fromEnv) {
		return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(root, fromEnv)
	}
	return path.join(root, 'dist')
}

function toErrorContext(error: unknown): AeroErrorContext {
	const unhandled = (error as { unhandled?: boolean }).unhandled ?? !HTTPError.isError(error)
	if (unhandled) {
		return { status: 500, message: 'Internal server error' }
	}
	const status = (error as { status?: number }).status ?? 500
	const message =
		error instanceof Error && error.message ? error.message : 'Internal server error'
	return { status, message }
}

function wantsJsonResponse(pathname: string, accept: string): boolean {
	const apiPrefix = process.env.AERO_API_PREFIX || '/api'
	if (pathname === apiPrefix || pathname.startsWith(`${apiPrefix}/`)) return true
	if (accept.includes('application/json') && !accept.includes('text/html')) return true
	return false
}

export default defineErrorHandler(async (error, event) => {
	const aeroError = toErrorContext(error)
	const url = getRequestURL(event)
	const accept = event.req.headers.get('accept') || ''

	if (wantsJsonResponse(url.pathname, accept)) {
		return Response.json(
			{ status: aeroError.status, message: aeroError.message },
			{ status: aeroError.status }
		)
	}

	const root = getProjectRoot()
	try {
		const html = await renderAeroError({
			root,
			error: aeroError,
			input: {
				url,
				request: event.req as Request,
				routePath: url.pathname,
			},
		})
		return new Response(html, {
			status: aeroError.status,
			headers: { 'content-type': 'text/html; charset=utf-8' },
		})
	} catch {
		const fallbackFile = aeroError.status === 404 ? '404.html' : '500.html'
		const fallbackPath = path.join(getDistDir(root), fallbackFile)
		try {
			const html = await fs.readFile(fallbackPath, 'utf-8')
			return new Response(html, {
				status: aeroError.status,
				headers: { 'content-type': 'text/html; charset=utf-8' },
			})
		} catch {
			return new Response(
				`<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body><h1>${aeroError.status}</h1><p>${aeroError.message}</p></body></html>`,
				{
					status: aeroError.status,
					headers: { 'content-type': 'text/html; charset=utf-8' },
				}
			)
		}
	}
})
