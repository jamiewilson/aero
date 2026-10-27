/**
 * Maps `-component` / `-layout` tag bases to discovered template files and import specifiers.
 */

import path from 'node:path'
import { walkHtmlFiles, walkHtmlFilesDirectOnly } from './fs-walk'
import { kebabToCamelCase } from './helpers'

export type TemplateTagKind = 'component' | 'layout'

export type TemplateTagEntry = {
	readonly absPath: string
	readonly tagBase: string
	readonly binding: string
	readonly specifier: string
}

export type TemplateTagIndex = {
	readonly components: ReadonlyMap<string, readonly TemplateTagEntry[]>
	readonly layouts: ReadonlyMap<string, readonly TemplateTagEntry[]>
}

export type ResolveTemplateTagResult =
	| { readonly status: 'ok'; readonly entry: TemplateTagEntry }
	| { readonly status: 'missing'; readonly tagBase: string; readonly kind: TemplateTagKind }
	| {
			readonly status: 'ambiguous'
			readonly tagBase: string
			readonly kind: TemplateTagKind
			readonly candidates: readonly TemplateTagEntry[]
	  }

const DEFAULT_COMPONENTS_ALIAS = '@components'
const DEFAULT_LAYOUTS_ALIAS = '@layouts'

function toPosixRelative(fromDir: string, absPath: string): string {
	return path.relative(fromDir, absPath).split(path.sep).join('/')
}

function entryFromPath(absPath: string, rootDir: string, aliasPrefix: string): TemplateTagEntry {
	const resolved = path.resolve(absPath)
	const tagBase = path.basename(resolved, '.html')
	const rel = toPosixRelative(path.resolve(rootDir), resolved)
	return {
		absPath: resolved,
		tagBase,
		binding: kebabToCamelCase(tagBase),
		specifier: `${aliasPrefix}/${rel}`,
	}
}

function indexPaths(
	paths: readonly string[],
	rootDir: string,
	aliasPrefix: string
): Map<string, TemplateTagEntry[]> {
	const map = new Map<string, TemplateTagEntry[]>()
	for (const absPath of paths) {
		const entry = entryFromPath(absPath, rootDir, aliasPrefix)
		const list = map.get(entry.tagBase) ?? []
		list.push(entry)
		map.set(entry.tagBase, list)
	}
	for (const [key, list] of map) {
		list.sort((a, b) => a.absPath.localeCompare(b.absPath))
		map.set(key, list)
	}
	return map
}

function freezeIndexMap(
	map: Map<string, TemplateTagEntry[]>
): ReadonlyMap<string, readonly TemplateTagEntry[]> {
	const out = new Map<string, readonly TemplateTagEntry[]>()
	for (const [key, entries] of map) {
		out.set(key, entries)
	}
	return out
}

export type BuildTemplateTagIndexFromPathsOptions = {
	readonly componentPaths: readonly string[]
	readonly layoutPaths: readonly string[]
	readonly componentsDir: string
	readonly layoutsDir: string
	readonly componentsAlias?: string
	readonly layoutsAlias?: string
}

/** Build an index from already-discovered absolute template paths. */
export function buildTemplateTagIndexFromPaths(
	options: BuildTemplateTagIndexFromPathsOptions
): TemplateTagIndex {
	const componentsDir = path.resolve(options.componentsDir)
	const layoutsDir = path.resolve(options.layoutsDir)
	const componentsAlias = options.componentsAlias ?? DEFAULT_COMPONENTS_ALIAS
	const layoutsAlias = options.layoutsAlias ?? DEFAULT_LAYOUTS_ALIAS

	return {
		components: freezeIndexMap(indexPaths(options.componentPaths, componentsDir, componentsAlias)),
		layouts: freezeIndexMap(indexPaths(options.layoutPaths, layoutsDir, layoutsAlias)),
	}
}

export type BuildTemplateTagIndexOptions = {
	readonly componentsDir: string
	readonly layoutsDir: string
	readonly componentsAlias?: string
	readonly layoutsAlias?: string
}

/** Discover templates under configured dirs and build the tag index. */
export function buildTemplateTagIndex(options: BuildTemplateTagIndexOptions): TemplateTagIndex {
	const componentsDir = path.resolve(options.componentsDir)
	const layoutsDir = path.resolve(options.layoutsDir)
	return buildTemplateTagIndexFromPaths({
		componentPaths: walkHtmlFiles(componentsDir).sort((a, b) => a.localeCompare(b)),
		layoutPaths: walkHtmlFilesDirectOnly(layoutsDir).sort((a, b) => a.localeCompare(b)),
		componentsDir,
		layoutsDir,
		componentsAlias: options.componentsAlias,
		layoutsAlias: options.layoutsAlias,
	})
}

/** Resolve a tag base to a single template entry. */
export function resolveTemplateTag(
	index: TemplateTagIndex,
	kind: TemplateTagKind,
	tagBase: string
): ResolveTemplateTagResult {
	const map = kind === 'component' ? index.components : index.layouts
	const candidates = map.get(tagBase) ?? []
	if (candidates.length === 0) {
		return { status: 'missing', tagBase, kind }
	}
	if (candidates.length > 1) {
		return { status: 'ambiguous', tagBase, kind, candidates }
	}
	return { status: 'ok', entry: candidates[0]! }
}

/** Human-readable error for missing or ambiguous resolution (diagnostics / compile errors). */
export function formatResolveTemplateTagError(
	result: Extract<ResolveTemplateTagResult, { status: 'missing' | 'ambiguous' }>
): string {
	const kindLabel = result.kind === 'component' ? 'Component' : 'Layout'
	if (result.status === 'missing') {
		return `${kindLabel} '${result.tagBase}' was not found under ${result.kind === 'component' ? DEFAULT_COMPONENTS_ALIAS : DEFAULT_LAYOUTS_ALIAS}.`
	}
	const paths = result.candidates.map(c => c.specifier).join(', ')
	return `${kindLabel} '${result.tagBase}' is ambiguous: multiple templates match (${paths}). Add an explicit import to choose one.`
}
