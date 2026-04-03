/**
 * On-disk cache for parsed content collection documents when incremental builds are enabled
 * (`AERO_INCREMENTAL` or `aero.config` `incremental: true`).
 *
 * @remarks
 * Per-file sha256 of raw bytes → cached post-transform document. Invalidated when
 * `content.config.ts` changes (config file hash).
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** Same opt-in as static prerender incremental (`packages/core` `build-manifest.ts`). */
export function isContentDiskCacheEnabled(): boolean {
	const v = process.env.AERO_INCREMENTAL?.trim().toLowerCase()
	return v === '1' || v === 'true' || v === 'yes'
}

export const CONTENT_CACHE_REL_PATH = path.join('.aero', 'cache', 'content-collections.json')

export function getContentCachePath(root: string): string {
	return path.join(root, CONTENT_CACHE_REL_PATH)
}

export function hashFileSha256(absolutePath: string): string | null {
	try {
		const buf = fs.readFileSync(absolutePath)
		return createHash('sha256').update(buf).digest('hex')
	} catch {
		return null
	}
}

/** One cached file: raw hash + JSON-serializable document output. */
export interface ContentCacheFileEntry {
	hash: string
	doc: unknown
}

export interface ContentCacheCollectionSlice {
	files: Record<string, ContentCacheFileEntry>
}

export interface ContentCollectionsCache {
	version: 1
	configHash: string
	collections: Record<string, ContentCacheCollectionSlice>
}

export function readContentCache(root: string): ContentCollectionsCache | null {
	const p = getContentCachePath(root)
	if (!fs.existsSync(p)) return null
	try {
		const raw = fs.readFileSync(p, 'utf-8')
		const data = JSON.parse(raw) as ContentCollectionsCache
		if (data.version !== 1 || typeof data.configHash !== 'string' || typeof data.collections !== 'object') {
			return null
		}
		return data
	} catch {
		return null
	}
}

export function writeContentCache(root: string, cache: ContentCollectionsCache): void {
	const p = getContentCachePath(root)
	fs.mkdirSync(path.dirname(p), { recursive: true })
	fs.writeFileSync(p, JSON.stringify(cache, null, '\t') + '\n', 'utf-8')
}

/**
 * Session for one `loadAllCollections` run: reads prior cache, serves hits per file, writes merged cache.
 */
export class ContentDiskCacheSession {
	private readonly root: string
	private data: ContentCollectionsCache
	private dirty = false

	constructor(root: string, contentConfigRelativePath: string) {
		this.root = root
		const absConfig = path.resolve(root, contentConfigRelativePath)
		const configHash = hashFileSha256(absConfig)
		if (!configHash) {
			this.data = { version: 1, configHash: '', collections: {} }
			return
		}
		const existing = readContentCache(root)
		if (existing && existing.configHash === configHash) {
			this.data = existing
		} else {
			this.data = { version: 1, configHash, collections: {} }
			this.dirty = true
		}
	}

	tryHit(collectionName: string, relKey: string, fileHash: string): unknown | undefined {
		const slice = this.data.collections[collectionName]?.files[relKey]
		if (slice && slice.hash === fileHash) return slice.doc
		return undefined
	}

	/**
	 * Replace one collection’s file map (call after loading all files in that collection).
	 */
	setCollectionSlice(collectionName: string, files: Record<string, ContentCacheFileEntry>): void {
		this.data.collections[collectionName] = { files }
		this.dirty = true
	}

	flush(): void {
		if (!this.dirty || !this.data.configHash) return
		writeContentCache(this.root, this.data)
	}
}
