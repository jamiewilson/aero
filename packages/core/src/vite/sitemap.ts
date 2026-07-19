/**
 * Generate sitemap.xml from route paths when a site URL is configured.
 */

import fs from 'node:fs'
import path from 'node:path'

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

/**
 * Generate sitemap.xml from route paths. Only called when site URL is set.
 * Excludes 404. Writes to distDir/sitemap.xml.
 */
export function writeSitemap(routePaths: string[], site: string, distDir: string): void {
	const base = site.replace(/\/$/, '')
	const urls = routePaths
		.filter(r => r !== '404')
		.map(routePath => {
			const pathSegment = routePath === '' ? '' : `/${routePath}/`
			const loc = `${base}${pathSegment || '/'}`
			return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`
		})
	const xml =
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
		urls.join('\n') +
		'\n</urlset>\n'
	fs.writeFileSync(path.join(distDir, 'sitemap.xml'), xml, 'utf-8')
}
