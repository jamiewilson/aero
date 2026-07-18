/**
 * Filesystem walkers for template discovery under client directories.
 */

import fs from 'node:fs'
import path from 'node:path'

/** Recursively collect file paths under dir that match the predicate. */
export function walkFilesRecursive(dir: string, matches: (item: fs.Dirent) => boolean): string[] {
	if (!fs.existsSync(dir)) return []
	const files: string[] = []
	for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, item.name)
		if (item.isDirectory()) {
			files.push(...walkFilesRecursive(fullPath, matches))
			continue
		}
		if (item.isFile() && matches(item)) {
			files.push(fullPath)
		}
	}
	return files
}

/** Recursively collect all .html file paths under dir. */
export function walkHtmlFiles(dir: string): string[] {
	return walkFilesRecursive(dir, item => item.name.endsWith('.html'))
}

/** Only `*.html` directly in `dir` (matches `layouts/*.html` glob, not nested). */
export function walkHtmlFilesDirectOnly(dir: string): string[] {
	if (!fs.existsSync(dir)) return []
	const out: string[] = []
	for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
		if (item.isFile() && item.name.endsWith('.html')) {
			out.push(path.join(dir, item.name))
		}
	}
	return out
}

/** Recursively collect all file paths under dir (no extension filter). */
export function walkFiles(dir: string): string[] {
	return walkFilesRecursive(dir, () => true)
}
