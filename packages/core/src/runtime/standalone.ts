import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import { compileTemplate } from '@aero-js/compiler'
import { Aero } from './index'
import type {
	AeroPageModule,
	StandaloneLoadCompiledModuleOptions,
	StandaloneRenderTemplateOptions,
} from '../types'

function toDataUrl(moduleSource: string): string {
	return `data:text/javascript;charset=utf-8,${encodeURIComponent(moduleSource)}`
}

function normalizeResolvedPath(resolved: string, root: string, importer: string): string {
	if (path.isAbsolute(resolved)) return resolved
	if (resolved.startsWith('/')) return path.resolve(root, '.' + resolved)
	if (resolved.startsWith('.')) return path.resolve(path.dirname(importer), resolved)
	return resolved
}

function resolveStandaloneSpecifier(
	specifier: string,
	root: string,
	importer: string,
	resolvePath?: (specifier: string, importer: string) => string
): string {
	const next = resolvePath ? resolvePath(specifier, importer) : specifier
	const abs = normalizeResolvedPath(next, root, importer)
	if (!path.isAbsolute(abs)) {
		throw new Error(
			`[aero] standalone import resolution failed for ${JSON.stringify(specifier)} from ${importer}`
		)
	}
	return abs
}

function createStandaloneResolveImportMeta(
	root: string,
	importer: string,
	resolvePath?: (specifier: string, importer: string) => string
): (specifier: string) => string {
	return (specifier: string) => {
		const abs = resolveStandaloneSpecifier(specifier, root, importer, resolvePath)
		return pathToFileURL(abs).href
	}
}

function injectImportMetaResolveBridge(compiledSource: string, resolveExpr: string): string {
	return compiledSource.replace(/import\.meta\.resolve\(/g, `${resolveExpr}(`)
}

function replaceDynamicImportSpecifiers(
	moduleSource: string,
	replacer: (rawSpecifier: string) => string
): string {
	return moduleSource.replace(/import\((['"])([^'"]+)\1\)/g, (_full, quote, specifier: string) => {
		const next = replacer(specifier)
		return `import(${quote}${next}${quote})`
	})
}

async function rewriteCompiledImportsForStandalone(options: {
	compiledSource: string
	root: string
	importer: string
	resolvePath?: (specifier: string, importer: string) => string
	cache: Map<string, string>
}): Promise<string> {
	const { compiledSource, root, importer, resolvePath, cache } = options
	const rewritten = replaceDynamicImportSpecifiers(compiledSource, specifier => {
		const abs = resolveStandaloneSpecifier(specifier, root, importer, resolvePath)
		if (abs.endsWith('.html')) {
			if (!cache.has(abs)) cache.set(abs, `__AERO_HTML_PLACEHOLDER__${abs}__`)
			return cache.get(abs)!
		}
		return pathToFileURL(abs).href
	})

	let out = rewritten
	for (const [absHtmlPath, placeholder] of cache.entries()) {
		if (!out.includes(placeholder)) continue
		let htmlSource: string
		try {
			htmlSource = await fs.promises.readFile(absHtmlPath, 'utf8')
		} catch {
			throw new Error(
				`[aero] standalone import resolution failed for ${JSON.stringify(absHtmlPath)} from ${importer}`
			)
		}
		const compiledChild = compileTemplate(htmlSource, {
			root,
			importer: absHtmlPath,
			resolvePath,
		})
		const rewrittenChild = await rewriteCompiledImportsForStandalone({
			compiledSource: compiledChild,
			root,
			importer: absHtmlPath,
			resolvePath,
			cache,
		})
		out = out.replaceAll(placeholder, toDataUrl(rewrittenChild))
	}

	return out
}

/**
 * Load compiled Aero module source in ESM environments and return an `AeroPageModule`.
 */
export async function loadCompiledTemplateModule(
	options: StandaloneLoadCompiledModuleOptions
): Promise<AeroPageModule> {
	const { compiledSource, root, importer, resolvePath } = options
	if (!root) throw new Error('[aero] standalone runtime requires `root`.')
	if (!importer) throw new Error('[aero] standalone runtime requires `importer`.')
	const resolveBridgeName = `__aeroStandaloneImportResolve_${Math.random().toString(36).slice(2)}`
	const resolveFn = createStandaloneResolveImportMeta(root, importer, resolvePath)
	;(globalThis as Record<string, unknown>)[resolveBridgeName] = resolveFn
	const rewrittenForStandalone = await rewriteCompiledImportsForStandalone({
		compiledSource,
		root,
		importer,
		resolvePath,
		cache: new Map(),
	})
	const bridgedSource = injectImportMetaResolveBridge(
		rewrittenForStandalone,
		`globalThis.${resolveBridgeName}`
	)
	const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'aero-standalone-module-'))
	const tmpModulePath = path.join(tmpDir, path.basename(importer, path.extname(importer)) + '.mjs')
	await fs.promises.writeFile(tmpModulePath, bridgedSource, 'utf8')
	try {
		const mod = (await import(/* @vite-ignore */ pathToFileURL(tmpModulePath).href)) as {
			default?: unknown
			getStaticPaths?: unknown
		}
		return {
			...(typeof mod.default === 'function' ? { default: mod.default as any } : {}),
			...(typeof mod.getStaticPaths === 'function'
				? { getStaticPaths: mod.getStaticPaths as any }
				: {}),
		}
	} catch (error) {
		throw new Error(
			`[aero] failed to load standalone compiled template module: ${String((error as Error).message ?? error)}`
		)
	} finally {
		await fs.promises.rm(tmpDir, { recursive: true, force: true })
		delete (globalThis as Record<string, unknown>)[resolveBridgeName]
	}
}

/**
 * One-shot standalone rendering helper: compile HTML source and render it with the Aero runtime.
 */
export async function renderTemplate(
	options: StandaloneRenderTemplateOptions
): Promise<string | null> {
	const { templateSource, root, importer, resolvePath, globals, input } = options
	if (!root) throw new Error('[aero] renderTemplate requires `root`.')
	if (!importer) throw new Error('[aero] renderTemplate requires `importer`.')
	const compiledSource = compileTemplate(templateSource, {
		root,
		importer,
		resolvePath,
	})
	const pageModule = await loadCompiledTemplateModule({
		compiledSource,
		root,
		importer,
		resolvePath,
	})
	const aero = new Aero()
	for (const [name, value] of Object.entries(globals ?? {})) {
		aero.global(name, value)
	}
	aero.registerPages({ [importer]: pageModule })
	return await aero.render(importer, input ?? {})
}

export { Aero }
