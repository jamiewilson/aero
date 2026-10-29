/**
 * Discover runtime template paths and reactive pages under client/.
 */

import fs from 'node:fs'
import path from 'node:path'
import { walkHtmlFiles, walkHtmlFilesDirectOnly } from '../utils/fs-walk'

const IS_STATE_SCRIPT_RE = /<script\b[^>]*\bis:state\b/i
const PAGE_COMPONENT_TAG_RE = /<([a-z][\w-]*-component)\b/gi

function readUtf8(filePath: string): string {
	try {
		return fs.readFileSync(filePath, 'utf-8')
	} catch {
		return ''
	}
}

/** Auto-import component tag for `client/components/foo-bar.html`. */
function componentTagFromPath(componentPath: string): string {
	const base = path.basename(componentPath, '.html')
	return `${base}-component`
}

function reactiveComponentTags(components: string[]): Set<string> {
	const tags = new Set<string>()
	for (const file of components) {
		if (IS_STATE_SCRIPT_RE.test(readUtf8(file))) {
			tags.add(componentTagFromPath(file))
		}
	}
	return tags
}

function pageReferencesReactiveComponent(pageSource: string, tags: Set<string>): boolean {
	if (tags.size === 0) return false
	for (const match of pageSource.matchAll(PAGE_COMPONENT_TAG_RE)) {
		const tag = match[1]!.toLowerCase()
		if (tags.has(tag)) return true
	}
	return false
}

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

/**
 * Page files that need a client `mountStateBindings` entry: own `<script is:state>` or a
 * reactive child component (so nested bindings mount in production).
 */
export function discoverReactivePagePaths(root: string, clientDir: string): string[] {
	const { pages, components } = discoverRuntimeTemplatePaths(root, clientDir)
	const reactiveTags = reactiveComponentTags(components)
	return pages.filter(file => {
		const source = readUtf8(file)
		if (!source) return false
		if (IS_STATE_SCRIPT_RE.test(source)) return true
		return pageReferencesReactiveComponent(source, reactiveTags)
	})
}
