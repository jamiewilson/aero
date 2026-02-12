import path from 'node:path'
import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createError, defineHandler, getRequestURL, serveStatic } from 'nitro/h3'

const distDir = path.resolve(process.cwd(), process.env.AERO_DIST || 'dist')
const distIndexPath = path.join(distDir, 'index.html')
const apiPrefix = process.env.AERO_API_PREFIX || '/api'

function resolveDistPath(id: string): string | null {
	const withLeadingSlash = id.startsWith('/') ? id : `/${id}`
	const resolved = path.resolve(distDir, `.${withLeadingSlash}`)
	if (resolved === distDir || resolved.startsWith(distDir + path.sep)) {
		return resolved
	}
	return null
}

export default defineHandler(async event => {
	const pathname = getRequestURL(event).pathname || '/'

	if (pathname === apiPrefix || pathname.startsWith(`${apiPrefix}/`)) {
		throw createError({ statusCode: 404, statusMessage: 'API route not found' })
	}

	if (!existsSync(distIndexPath)) {
		throw createError({
			statusCode: 500,
			statusMessage: 'Missing static build output. Run `pnpm run build` before previewing.',
		})
	}

	return serveStatic(event, {
		indexNames: ['/index.html'],
		getContents: async id => {
			const filePath = resolveDistPath(id)
			if (!filePath) return
			return readFile(filePath)
		},
		getMeta: async id => {
			const filePath = resolveDistPath(id)
			if (!filePath) return
			const fileStats = await stat(filePath).catch(() => null)
			if (fileStats?.isFile()) {
				return {
					size: fileStats.size,
					mtime: fileStats.mtimeMs,
				}
			}
			return
		},
	})
})
