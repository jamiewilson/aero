/**
 * Static build: manifest reading and HTML URL rewriting.
 *
 * @remarks
 * Used after pages are rendered to rewrite virtual client script URLs and absolute
 * href/src to dist-relative paths using the Vite manifest. Kept in a dedicated module
 * for clearer boundaries and reuse.
 */

import type { Manifest } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { parseHTML } from 'linkedom'

import {
	CLIENT_SCRIPT_PREFIX,
	DEFAULT_API_PREFIX,
	LINK_ATTRS,
	SKIP_PROTOCOL_REGEX,
} from './defaults'

import { toPosix } from '../utils/path'

/** Route path to output file path (e.g. '' → index.html, about → about/index.html). */
export function toOutputFile(routePath: string): string {
	if (routePath === '') return 'index.html'
	if (routePath === '404') return '404.html'
	return toPosix(path.join(routePath, 'index.html'))
}

/** Relative path from fromDir to targetPath, always starting with ./ when non-empty. */
export function normalizeRelativeLink(
	fromDir: string,
	targetPath: string
): string {
	const rel = path.posix.relative(fromDir, targetPath)
	if (!rel) return './'
	if (rel.startsWith('.')) return rel
	return `./${rel}`
}

/** Relative path to a route (directory index); appends trailing slash for non-root routes. */
export function normalizeRelativeRouteLink(
	fromDir: string,
	routePath: string
): string {
	const targetDir = routePath === '' ? '' : routePath
	const rel = path.posix.relative(fromDir, targetDir)
	let res = !rel ? './' : rel.startsWith('.') ? rel : `./${rel}`

	if (routePath !== '' && routePath !== '404' && !res.endsWith('/')) {
		res += '/'
	}
	return res
}

function normalizeRoutePathFromHref(value: string): string {
	if (value === '/') return ''
	return value.replace(/^\/+/, '').replace(/\/+$/, '')
}

function isSkippableUrl(value: string): boolean {
	if (!value) return true
	return SKIP_PROTOCOL_REGEX.test(value)
}

const ASSET_IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|svg|ico)(\?|$)/i

/** Rewrite one absolute URL to dist-relative using manifest and route set; leaves API and external URLs unchanged. */
export function rewriteAbsoluteUrl(
	value: string,
	fromDir: string,
	manifest: Manifest,
	routeSet: Set<string>,
	apiPrefix = DEFAULT_API_PREFIX
): string {
	if (value.startsWith(apiPrefix)) return value

	const noQuery = value.split(/[?#]/)[0] || value
	const suffix = value.slice(noQuery.length)
	const manifestKey = noQuery.replace(/^\//, '')
	let manifestEntry = manifest[noQuery] ?? manifest[manifestKey]

	if (!manifestEntry && noQuery.startsWith('assets/')) {
		const entry = Object.values(manifest).find(
			(e: any) => e?.file === noQuery || e?.file === manifestKey
		)
		if (entry) manifestEntry = entry as typeof manifestEntry
	}

	if (manifestEntry?.file) {
		const entryWithAssets = manifestEntry as { file: string; assets?: string[] }
		const imageAsset = entryWithAssets.assets?.find((a: string) =>
			ASSET_IMAGE_EXT.test(a)
		)
		const fileToUse = imageAsset ?? manifestEntry.file
		const rel = normalizeRelativeLink(fromDir, fileToUse)
		return rel + suffix
	}

	if (noQuery.startsWith('/assets/')) {
		const rel = normalizeRelativeLink(fromDir, noQuery.replace(/^\//, ''))
		return rel + suffix
	}

	const route = normalizeRoutePathFromHref(noQuery)
	if (routeSet.has(route) || route === '') {
		const rel =
			route === '404'
				? normalizeRelativeLink(fromDir, toOutputFile(route))
				: normalizeRelativeRouteLink(fromDir, route)
		return rel + suffix
	}

	const rel = normalizeRelativeLink(fromDir, noQuery.replace(/^\//, ''))
	return rel + suffix
}

/** Rewrite script src (virtual client → hashed asset) and LINK_ATTRS in rendered HTML; add doctype. */
export function rewriteRenderedHtml(
	html: string,
	outputFile: string,
	manifest: Manifest,
	routeSet: Set<string>,
	apiPrefix = DEFAULT_API_PREFIX
): string {
	const fromDir = path.posix.dirname(outputFile)
	const { document } = parseHTML(html)

	for (const script of Array.from(document.querySelectorAll('script[src]'))) {
		const src = script.getAttribute('src') || ''
		if (src.startsWith(CLIENT_SCRIPT_PREFIX)) {
			const newSrc = rewriteAbsoluteUrl(
				src,
				fromDir,
				manifest,
				routeSet,
				apiPrefix
			)
			script.setAttribute('src', newSrc)
			script.setAttribute('type', 'module')
			script.removeAttribute('defer')
			continue
		}
		if (script.getAttribute('type') === 'module') {
			script.removeAttribute('defer')
		}
	}

	for (const el of Array.from(document.querySelectorAll('*'))) {
		for (const attrName of LINK_ATTRS) {
			if (!el.hasAttribute(attrName)) continue
			const current = (el.getAttribute(attrName) || '').trim()
			if (!current || isSkippableUrl(current)) continue
			if (!current.startsWith('/')) continue
			el.setAttribute(
				attrName,
				rewriteAbsoluteUrl(current, fromDir, manifest, routeSet, apiPrefix)
			)
		}
	}

	const htmlTag = document.documentElement
	if (htmlTag) return addDoctype(htmlTag.outerHTML)
	return addDoctype(document.toString())
}

/** Prepend `<!doctype html>` if missing. */
export function addDoctype(html: string): string {
	return /^\s*<!doctype\s+html/i.test(html) ? html : `<!doctype html>\n${html}`
}

export function readManifest(distDir: string): Manifest {
	const manifestPath = path.join(distDir, '.vite', 'manifest.json')
	if (!fs.existsSync(manifestPath)) return {}
	return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Manifest
}
