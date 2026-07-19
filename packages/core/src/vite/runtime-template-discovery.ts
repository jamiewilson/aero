/**
 * Discover runtime template paths and reactive pages under client/.
 */

import fs from 'node:fs'
import path from 'node:path'
import { walkHtmlFiles, walkHtmlFilesDirectOnly } from '../utils/fs-walk'

const IS_STATE_SCRIPT_RE = /<script\b[^>]*\bis:state\b/i

/**
 * Discovered template paths (absolute), matching dev/runtime glob rules: components recursive,
 * layouts non-recursive, pages recursive.
 */
export function discoverRuntimeTemplatePaths(
	root: string,
	clientDir: string
): { components: string[]; layouts: string[]; pages: string[] } {
	const clientRoot = path.resolve(root, clientDir)
	return {
		components: walkHtmlFiles(path.join(clientRoot, 'components')).sort((a, b) =>
			a.localeCompare(b)
		),
		layouts: walkHtmlFilesDirectOnly(path.join(clientRoot, 'layouts')).sort((a, b) =>
			a.localeCompare(b)
		),
		pages: walkHtmlFiles(path.join(clientRoot, 'pages')).sort((a, b) => a.localeCompare(b)),
	}
}

/** Page files under `client/pages` that contain `<script is:state>`. */
export function discoverReactivePagePaths(root: string, clientDir: string): string[] {
	const { pages } = discoverRuntimeTemplatePaths(root, clientDir)
	return pages.filter(file => {
		try {
			return IS_STATE_SCRIPT_RE.test(fs.readFileSync(file, 'utf-8'))
		} catch {
			return false
		}
	})
}
