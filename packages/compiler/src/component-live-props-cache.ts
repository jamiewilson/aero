import fs from 'node:fs'
import path from 'node:path'
import type { ComponentLivePropMetadata } from './types'
import { collectLivePropMetadataForFile } from './component-registry-codegen'

type LivePropMetadataMap = Record<string, readonly ComponentLivePropMetadata[]>

type FileCacheEntry = {
	mtimeMs: number
	metadata: LivePropMetadataMap
}

function mergeLivePropMetadata(
	target: LivePropMetadataMap,
	source: LivePropMetadataMap
): void {
	for (const [key, value] of Object.entries(source)) {
		target[key] = value
	}
}

/**
 * Dev/editor cache for {@link collectComponentLivePropMetadata}.
 * Reuses per-file metadata when mtime is unchanged.
 */
export class ComponentLivePropMetadataCache {
	readonly #files = new Map<string, FileCacheEntry>()

	invalidate(filePath: string): void {
		this.#files.delete(path.resolve(filePath))
	}

	invalidateAll(): void {
		this.#files.clear()
	}

	collect(templateDirs: string | readonly string[]): LivePropMetadataMap {
		const dirs = Array.isArray(templateDirs) ? templateDirs : [templateDirs]
		const out: LivePropMetadataMap = {}

		const walk = (dir: string): void => {
			if (!fs.existsSync(dir)) return
			for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
				const full = path.join(dir, name.name)
				if (name.isDirectory()) {
					walk(full)
					continue
				}
				if (!name.isFile() || !name.name.endsWith('.html')) continue
				this.#mergeFile(out, full)
			}
		}

		for (const dir of dirs) walk(dir)
		return out
	}

	#mergeFile(out: LivePropMetadataMap, fullPath: string): void {
		const resolved = path.resolve(fullPath)
		let stat: fs.Stats
		try {
			stat = fs.statSync(resolved)
		} catch {
			this.#files.delete(resolved)
			return
		}

		const cached = this.#files.get(resolved)
		if (cached && cached.mtimeMs === stat.mtimeMs) {
			mergeLivePropMetadata(out, cached.metadata)
			return
		}

		const metadata = collectLivePropMetadataForFile(resolved)
		this.#files.set(resolved, { mtimeMs: stat.mtimeMs, metadata })
		mergeLivePropMetadata(out, metadata)
	}
}
