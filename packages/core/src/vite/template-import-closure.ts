/**
 * Transitive template import closure and file-hash helpers for incremental static prerender.
 */

import fs from 'node:fs'
import path from 'node:path'
import { analyzeBuildScript, parse } from '@aero-js/compiler'
import { toPosixRelative } from '../utils/path'
import { hashFileSha256 } from './build-manifest'
import { loadTsconfigAliases } from '../utils/aliases'
import { walkHtmlFiles } from '../utils/fs-walk'

/** Per `*.html` file under `clientDir` → sha256 (keys: posix path relative to `root`). */
export function computeTemplateFileHashesMap(root: string, clientDir: string): Record<string, string> {
	const base = path.resolve(root, clientDir)
	const files = walkHtmlFiles(base)
	const out: Record<string, string> = {}
	for (const f of files) {
		const h = hashFileSha256(f)
		if (h) {
			out[toPosixRelative(f, root)] = h
		}
	}
	return out
}

function isUnderClientRoot(absFile: string, clientRoot: string): boolean {
	const norm = path.normalize(absFile)
	const base = path.normalize(clientRoot)
	return norm === base || norm.startsWith(base + path.sep)
}

/**
 * Transitive template `.html` dependencies via `import` lines in `<script is:build>` (build script analysis).
 * Used for incremental static prerender: which pages to re-render when specific files change.
 */
export function collectTransitiveTemplateImports(
	root: string,
	clientDir: string,
	resolvePath: (specifier: string, importer: string) => string,
	entryAbs: string
): Set<string> {
	const clientRoot = path.resolve(root, clientDir)
	const result = new Set<string>()
	const visited = new Set<string>()

	function visit(abs: string): void {
		const norm = path.normalize(abs)
		if (visited.has(norm)) return
		if (!norm.endsWith('.html') || !fs.existsSync(norm)) return
		if (!isUnderClientRoot(norm, clientRoot)) return
		visited.add(norm)
		result.add(toPosixRelative(norm, root))

		const raw = fs.readFileSync(norm, 'utf-8')
		const parsed = parse(raw)
		if (!parsed.buildScript?.content?.trim()) return

		let analysis: ReturnType<typeof analyzeBuildScript>
		try {
			analysis = analyzeBuildScript(parsed.buildScript.content)
		} catch {
			return
		}

		for (const imp of analysis.imports) {
			let resolved: string
			try {
				resolved = resolvePath(imp.specifier, norm)
			} catch {
				continue
			}
			const absNext = path.isAbsolute(resolved)
				? path.normalize(resolved)
				: path.normalize(path.resolve(path.dirname(norm), resolved))
			if (!absNext.endsWith('.html') || !fs.existsSync(absNext)) continue
			visit(absNext)
		}
	}

	visit(path.normalize(entryAbs))
	return result
}

export function getResolvePathForProject(
	root: string,
	explicit?: (specifier: string, importer: string) => string
): (specifier: string, importer: string) => string {
	return explicit ?? loadTsconfigAliases(root).resolve
}
