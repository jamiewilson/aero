/**
 * Collect `.css` files under client assets styles directories.
 */

import path from 'node:path'
import { walkFilesRecursive } from '../utils/fs-walk'

export function listCssFiles(dir: string): string[] {
	return walkFilesRecursive(dir, item => item.name.endsWith('.css'))
}

/** Collect `.css` files under a client assets styles directory when present. */
export function collectClientStyleCssFiles(root: string, clientDir: string): string[] {
	const stylesDir = path.join(root, clientDir, 'assets', 'styles')
	return listCssFiles(stylesDir)
}
