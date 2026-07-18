/**
 * Collect `.css` files under client assets styles directories.
 */

import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

export function listCssFiles(dir: string, out: string[] = []): string[] {
	let entries: string[]
	try {
		entries = readdirSync(dir)
	} catch {
		return out
	}
	for (const name of entries) {
		const full = path.join(dir, name)
		let st
		try {
			st = statSync(full)
		} catch {
			continue
		}
		if (st.isDirectory()) listCssFiles(full, out)
		else if (st.isFile() && name.endsWith('.css')) out.push(full)
	}
	return out
}

/** Collect `.css` files under a client assets styles directory when present. */
export function collectClientStyleCssFiles(root: string, clientDir: string): string[] {
	const stylesDir = path.join(root, clientDir, 'assets', 'styles')
	return listCssFiles(stylesDir)
}
