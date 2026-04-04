/**
 * On-disk build manifest for Phase B incremental static prerender (`.aero/cache/`).
 *
 * @remarks
 * When `AERO_INCREMENTAL` is set, we can skip the entire prerender phase if the Vite client
 * manifest, all HTML under `client/`, and static build options match the last successful run.
 * Projects with dynamic pages (`[param]` routes) never skip — `getStaticPaths` must run every time.
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** Bump when the JSON shape or invalidation rules change. */
export const AERO_BUILD_MANIFEST_VERSION = 2 as const

const AERO_BUILD_MANIFEST_REL_PATH = path.join('.aero', 'cache', 'build-manifest.json')

interface AeroBuildManifestPageEntry {
	outputFile: string
}

export interface AeroBuildManifest {
	/** `1` = legacy; `2` adds per-file template hashes for partial prerender. */
	version: 1 | typeof AERO_BUILD_MANIFEST_VERSION
	generatedAt: string
	viteManifestHash: string
	clientHtmlFingerprint: string
	staticBuildOptionsHash: string
	/**
	 * Per `*.html` path under `client/` (posix, relative to project root) → sha256 of file bytes.
	 * Stable cache keys for incremental prerender: content-only hash per template + route graph elsewhere.
	 */
	templateFileHashes?: Record<string, string>
	pages: Record<string, AeroBuildManifestPageEntry>
}

function getBuildManifestPath(root: string): string {
	return path.join(root, AERO_BUILD_MANIFEST_REL_PATH)
}

/** True when incremental static prerender should be considered (`AERO_INCREMENTAL=1` or `true`). */
export function isIncrementalStaticBuildEnabled(): boolean {
	const v = process.env.AERO_INCREMENTAL?.trim().toLowerCase()
	return v === '1' || v === 'true' || v === 'yes'
}

export function hashFileSha256(absolutePath: string): string | null {
	try {
		const buf = fs.readFileSync(absolutePath)
		return createHash('sha256').update(buf).digest('hex')
	} catch {
		return null
	}
}

/** Hash Vite's `dist/.vite/manifest.json` for fingerprinting the Rolldown output graph. */
export function hashViteOutputManifest(distDir: string): string | null {
	const manifestPath = path.join(distDir, '.vite', 'manifest.json')
	return hashFileSha256(manifestPath)
}

/**
 * Fingerprint of every `*.html` under `root/clientRoot` (recursive), sorted by relative path.
 * Any template change invalidates the fingerprint.
 */
export function computeClientHtmlFingerprint(root: string, clientRoot: string): string {
	const base = path.resolve(root, clientRoot)
	const files: string[] = []
	function walk(dir: string): void {
		if (!fs.existsSync(dir)) return
		for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, item.name)
			if (item.isDirectory()) {
				walk(full)
				continue
			}
			if (item.isFile() && item.name.endsWith('.html')) files.push(full)
		}
	}
	walk(base)
	files.sort((a, b) => a.localeCompare(b))
	const h = createHash('sha256')
	for (const f of files) {
		const rel = path.relative(root, f).split(path.sep).join('/')
		h.update(rel)
		h.update('\0')
		h.update(fs.readFileSync(f))
	}
	return h.digest('hex')
}

export function hashStaticBuildOptions(site: string | undefined, redirectsJson: string): string {
	return createHash('sha256')
		.update(site ?? '')
		.update('\0')
		.update(redirectsJson)
		.digest('hex')
}

export function readBuildManifest(root: string): AeroBuildManifest | null {
	const p = getBuildManifestPath(root)
	if (!fs.existsSync(p)) return null
	try {
		const raw = fs.readFileSync(p, 'utf-8')
		const data = JSON.parse(raw) as AeroBuildManifest
		if (data.version !== 1 && data.version !== AERO_BUILD_MANIFEST_VERSION) return null
		if (
			typeof data.viteManifestHash !== 'string' ||
			typeof data.clientHtmlFingerprint !== 'string' ||
			typeof data.staticBuildOptionsHash !== 'string' ||
			typeof data.pages !== 'object' ||
			data.pages === null
		) {
			return null
		}
		return data
	} catch {
		return null
	}
}

export function writeBuildManifest(root: string, manifest: AeroBuildManifest): void {
	const p = getBuildManifestPath(root)
	fs.mkdirSync(path.dirname(p), { recursive: true })
	fs.writeFileSync(p, JSON.stringify(manifest, null, '\t') + '\n', 'utf-8')
}

export function canSkipEntirePrerender(args: {
	previous: AeroBuildManifest | null
	currentViteManifestHash: string | null
	currentClientHtmlFingerprint: string
	currentStaticBuildOptionsHash: string
}): boolean {
	const {
		previous,
		currentViteManifestHash,
		currentClientHtmlFingerprint,
		currentStaticBuildOptionsHash,
	} = args
	// No fingerprint without a Rolldown manifest (e.g. broken or partial dist).
	if (!previous || currentViteManifestHash === null) return false
	return (
		previous.viteManifestHash === currentViteManifestHash &&
		previous.clientHtmlFingerprint === currentClientHtmlFingerprint &&
		previous.staticBuildOptionsHash === currentStaticBuildOptionsHash
	)
}

/** Paths (posix rel to root) whose content changed between manifest snapshots. */
export function diffTemplateFileHashes(
	previous: Record<string, string> | undefined,
	current: Record<string, string>
): string[] {
	if (!previous) return Object.keys(current).sort()
	const changed: string[] = []
	for (const [k, v] of Object.entries(current)) {
		if (previous[k] !== v) changed.push(k)
	}
	for (const k of Object.keys(previous)) {
		if (!(k in current)) changed.push(k)
	}
	return changed.sort()
}
