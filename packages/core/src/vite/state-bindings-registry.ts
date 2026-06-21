import path from 'node:path'
import { pagePathToKey } from '../utils/routing'

function toRootRelativeImportUrl(root: string, absolutePath: string): string {
	const rel = path.relative(root, absolutePath).split(path.sep).join('/')
	return '/' + rel.replace(/^\//, '')
}

function toPosixPageKey(root: string, absolutePath: string): string {
	return path.relative(root, absolutePath).split(path.sep).join('/')
}

/**
 * Generated client module: lazy-load compiled page chunks and return `mountStateBindings`.
 * Written to `.aero/state-bindings-registry.mjs` during production builds.
 */
export function getStateBindingsRegistryModuleSource(
	root: string,
	reactivePagePaths: string[]
): string {
	if (reactivePagePaths.length === 0) {
		return `export async function resolveStateBindingsModule(_pathname) {
	return null
}
`
	}

	const entries: string[] = []
	for (let i = 0; i < reactivePagePaths.length; i++) {
		const pagePath = reactivePagePaths[i]!
		const pageName = pagePathToKey(toPosixPageKey(root, pagePath))
		const importUrl = toRootRelativeImportUrl(root, pagePath)
		entries.push(`${JSON.stringify(pageName)}: () => import(${JSON.stringify(importUrl)})`)
	}

	return `const __aeroStatePageLoaders = {
	${entries.join(',\n\t')}
}

function __aeroResolvePageName(url) {
	const pathPart = String(url ?? '/').split('?')[0] || '/'
	let clean = pathPart
	if (clean === '/' || clean === '') return 'index'
	if (clean.endsWith('/')) clean = clean + 'index'
	clean = clean.replace(/^\\//, '').replace(/\\.html$/, '')
	return clean || 'index'
}

function __aeroResolveStatePageLoader(pageName) {
	let loader = __aeroStatePageLoaders[pageName]
	if (!loader) loader = __aeroStatePageLoaders[\`\${pageName}/index\`]
	if (!loader && pageName === 'index') loader = __aeroStatePageLoaders.home
	if (!loader && pageName.endsWith('/index')) {
		loader = __aeroStatePageLoaders[pageName.slice(0, -'/index'.length)]
	}
	return loader ?? null
}

export async function resolveStateBindingsModule(pathname) {
	const loader = __aeroResolveStatePageLoader(__aeroResolvePageName(pathname))
	if (!loader) return null
	const mod = await loader()
	return typeof mod.mountStateBindings === 'function' ? mod.mountStateBindings : null
}
`
}
