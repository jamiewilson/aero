import path from 'node:path'
import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { HTTPError, defineHandler, getRequestURL, serveStatic } from 'nitro/h3'

const distDir = path.resolve(process.cwd(), process.env.AERO_DIST || 'dist')
const distIndexPath = path.join(distDir, 'index.html')
const dist404Path = path.join(distDir, '404.html')
const apiPrefix = process.env.AERO_API_PREFIX || '/api'

function resolveDistPath(id: string): string | null {
	const withLeadingSlash = id.startsWith('/') ? id : `/${id}`
	const resolved = path.resolve(distDir, `.${withLeadingSlash}`)
	if (resolved === distDir || resolved.startsWith(distDir + path.sep)) {
		return resolved
	}
	return null
}

/**
 * Check whether a path (without trailing slash) maps to a directory that
 * contains an index.html file.  When true the client should be redirected
 * to `pathname + '/'` so that relative links inside the page resolve
 * correctly (e.g. `./name` from `/docs/` → `/docs/name`).
 */
function needsTrailingSlashRedirect(pathname: string): boolean {
	if (pathname === '/' || pathname.endsWith('/')) return false
	const indexPath = resolveDistPath(`${pathname}/index.html`)
	return !!indexPath && existsSync(indexPath)
}

export default defineHandler(async event => {
	const url = getRequestURL(event)
	const pathname = url.pathname || '/'

	if (pathname === apiPrefix || pathname.startsWith(`${apiPrefix}/`)) {
		throw HTTPError.status(404, 'API route not found')
	}

	if (!existsSync(distIndexPath)) {
		throw HTTPError.status(500, 'Run `pnpm run build` before previewing.')
	}

	// Redirect bare directory paths to include a trailing slash so that
	// relative links inside the served index.html resolve correctly.
	if (needsTrailingSlashRedirect(pathname)) {
		const target = `${pathname}/${url.search || ''}`
		return new Response(null, {
			status: 301,
			headers: { Location: target },
		})
	}

	const result = await serveStatic(event, {
		fallthrough: true,
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

	// If serveStatic didn't match a file, serve the 404 page.
	// The built 404.html uses relative paths (e.g. ./assets/…) which only
	// resolve correctly from the site root.  Rewrite them to absolute so the
	// page renders with styles/scripts regardless of the request path depth.
	if (!result) {
		if (existsSync(dist404Path)) {
			const html = (await readFile(dist404Path, 'utf-8')).replace(
				/(href|src|content)="\.\/([^"]*?)"/g,
				'$1="/$2"',
			)
			return new Response(html, {
				status: 404,
				headers: { 'Content-Type': 'text/html; charset=utf-8' },
			})
		}
		throw HTTPError.status(404, 'Not found')
	}

	return result
})
