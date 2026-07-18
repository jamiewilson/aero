/**
 * Detect Aero template HTML under client/pages, client/components, or client/layouts.
 */

import path from 'path'
import type { AeroPluginState } from './plugin-state'

/** True if filePath is an Aero template under client/pages, client/components, or client/layouts. */
export function isAeroTemplateHtml(
	filePath: string,
	root: string,
	dirs: AeroPluginState['dirs']
): boolean {
	const clientBase = path.join(root, dirs.client)
	const rel = path.relative(clientBase, filePath)
	if (rel.startsWith('..') || path.isAbsolute(rel)) return false
	const sep = path.sep
	return (
		rel.startsWith('pages' + sep) ||
		rel.startsWith('components' + sep) ||
		rel.startsWith('layouts' + sep)
	)
}
