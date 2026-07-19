import { pagePathToKey } from '../utils/routing'
import { toPosixRelative, toRootRelativeImportUrl } from '../utils/path'
import { emitResolvePageNameFnSource } from '../utils/resolve-page-name'

function toPosixPageKey(root: string, absolutePath: string): string {
	return toPosixRelative(absolutePath, root)
}

/**
 * Generated client module: lazy-load compiled page chunks and return `mountStateBindings`.
 * Written to `.aero/state-bindings-registry.mjs` during production builds.
 *
 * @remarks
 * Must not import `@aero-js/core/*` — production aliases `@aero-js/core` to `entry-prod.mjs`,
 * so subpath imports resolve as `entry-prod.mjs/utils/...` and fail. Page-name logic is
 * inlined from {@link emitResolvePageNameFnSource} instead.
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

	return `${emitResolvePageNameFnSource('__aeroResolvePageName')}

const __aeroStatePageLoaders = {
	${entries.join(',\n\t')}
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
