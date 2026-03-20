/**
 * Aero Vite plugin: HTML transform, virtual modules, dev server middleware, and static build.
 *
 * @remarks
 * Split into focused sub-plugins: config, virtuals (resolve/load), transform, SSR middleware.
 * Static build plugin runs after closeBundle; Nitro and image optimizer are composed in the factory.
 */

import type {
	AeroMiddlewareResult,
	AeroOptions,
	AliasResult,
	AeroRenderInput,
	ScriptEntry,
} from '../types'
import type {
	DevEnvironment,
	Plugin,
	PluginOption,
	ResolvedConfig,
	ViteDevServer,
	WebSocketServer,
} from 'vite'
import { createLogger, createRunnableDevEnvironment } from 'vite'
import { extractObjectKeys } from '../utils/parse'
import { isRunnableDevEnvironment } from 'vite'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { nitro } from 'nitro/vite'
import {
	AERO_EMPTY_INLINE_CSS_PREFIX,
	AERO_HTML_VIRTUAL_PREFIX,
	CLIENT_SCRIPT_PREFIX,
	DEFAULT_API_PREFIX,
	getClientScriptVirtualUrl,
	RESOLVED_RUNTIME_INSTANCE_MODULE_ID,
	resolveDirs,
	RUNTIME_INSTANCE_MODULE_ID,
} from './defaults'

import {
	AERO_DIAGNOSTICS_HTTP_HEADER,
	type AeroCompileError,
	aeroDiagnosticToViteErrorFields,
	buildDevSsrErrorHtml,
	diagnosticsToSingleMessage,
	encodeDiagnosticsHeaderValue,
	AERO_EXIT_NITRO,
	enrichDiagnosticsWithSourceFrames,
	exitFailureToAeroDiagnostics,
	exitCodeForThrown,
	formatDiagnosticsTerminal,
	unknownToAeroDiagnostics,
} from '@aero-js/diagnostics'
import { Effect, Exit } from 'effect'
import { htmlCompileTry } from './compile-html-effect'
import { parse } from '../compiler/parser'
import { compileTemplate } from '../compiler/codegen'
import { resolvePageName } from '../utils/routing'
import { loadTsconfigAliases, mergeWithDefaultAliases } from '../utils/aliases'
import { redirectsToRouteRules } from '../utils/redirects'
import { toPosixRelative } from '../utils/path'
import {
	createBuildConfig,
	discoverClientScriptContentMap,
	renderStaticPages,
	registerClientScriptsToMap,
	addDoctype,
} from './build'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'path'

import {
	createAeroSsrHmrLogger,
	mergeSsrRunnerOptionsWithHmrLogger,
	wrapAeroViteLogger,
} from './aero-vite-logger'

const require = createRequire(import.meta.url)

/** Shared state used by the Aero sub-plugins (config, virtuals, transform, ssr). */
interface AeroPluginState {
	config: ResolvedConfig | null
	aliasResult: AliasResult | null
	clientScripts: Map<string, ScriptEntry>
	runtimeInstancePath: string
	/** Set in configResolved: path to .aero/runtime-instance.mjs so Vite treats it as a real module (glob rules). */
	generatedRuntimeInstancePath: string | null
	dirs: ReturnType<typeof resolveDirs>
	apiPrefix: string
	options: AeroOptions
}

/** Compare two ScriptEntry records for semantic equality (used to detect client script changes on HMR). */
function sameScriptEntry(a: ScriptEntry | undefined, b: ScriptEntry | undefined): boolean {
	if (!a || !b) return false
	return (
		a.content === b.content &&
		a.passDataExpr === b.passDataExpr &&
		a.injectInHead === b.injectInHead
	)
}

const AERO_DIR = '.aero'
const NITRO_CONFIG_FILENAME = 'nitro.config.mjs'
/** Filename for the generated runtime instance (uses app dirs for globs); written under .aero so Vite treats it as a real module. */
const RUNTIME_INSTANCE_FILENAME = 'runtime-instance.mjs'

/**
 * Generate Nitro config from Aero options and write to <projectRoot>/.aero/nitro.config.mjs.
 * root is the app/site directory (Vite config.root), e.g. examples/kitchen-sink or an @aero-js/create project folder.
 * distDir is the configured output dir (e.g. 'build') so the catch-all route serves from the same path at preview time.
 * Returns the absolute path to .aero (Nitro cwd so it loads this file).
 */
function writeGeneratedNitroConfig(
	root: string,
	serverDir: string,
	redirects: AeroOptions['redirects'],
	distDir: string,
): string {
	const aeroDir = path.join(root, AERO_DIR)
	mkdirSync(aeroDir, { recursive: true })
	const routeRules = redirectsToRouteRules(redirects ?? [])
	// Run Nitro with cwd=.aero; rootDir points to project root. Output dir must be absolute so .output lands in project root.
	// scanDirs must be absolute so Nitro finds server/ when cwd is .aero (relative 'server' would resolve to .aero/server and miss routes).
	// noPublicDir: true so Nitro does not serve from .output/public; server/routes/[...].ts catch-all serves static from dist at runtime.
	// replace inlines process.env.AERO_DIST so preview:api serves from the same dir as vite build output (e.g. build/ when dist: './build').
	const nitroConfig = {
		rootDir: '..',
		output: { dir: path.join(root, '.output') },
		scanDirs: [path.join(root, serverDir)],
		routeRules,
		noPublicDir: true,
		replace: {
			'process.env.AERO_DIST': JSON.stringify(distDir),
		},
	}
	const content = `// Generated by Aero — do not edit
export default ${JSON.stringify(nitroConfig, null, 2)}
`
	writeFileSync(path.join(aeroDir, NITRO_CONFIG_FILENAME), content)
	return aeroDir
}

/** Run `nitro build` with generated config; used after static pages are written when options.server is true. */
async function runNitroBuild(_root: string, configCwd: string): Promise<void> {
	const nitroBin = process.platform === 'win32' ? 'nitro.cmd' : 'nitro'
	await new Promise<void>((resolve, reject) => {
		const child = spawn(nitroBin, ['build'], {
			cwd: configCwd,
			stdio: 'inherit',
			env: process.env,
		})

		child.on('error', reject)
		child.on('exit', code => {
			if (code === 0) {
				resolve()
				return
			}
			reject(new Error(`[aero] nitro build failed with exit code ${code ?? 'null'}`))
		})
	})
}

function createAeroConfigPlugin(state: AeroPluginState): Plugin {
	return {
		name: 'vite-plugin-aero-config',
		enforce: 'pre',
		config(userConfig, env) {
			const root = userConfig.root || process.cwd()
			const rawAliases = loadTsconfigAliases(root)
			state.aliasResult = mergeWithDefaultAliases(rawAliases, root, state.dirs)
			const site = state.options.site?.url ?? ''

			// Production build: use minimal client entry (no instance/template chunks) so dist/assets stays small.
			const alias =
				env?.command === 'build'
					? [
							...state.aliasResult.aliases,
							{
								find: '@aero-js/core',
								replacement: require.resolve('@aero-js/core/entry-prod'),
							},
						]
					: state.aliasResult.aliases

			// Ensure SSR environment exists so dev middleware can load the runtime via ssrEnv.runner.import.
			// Required for non-server projects (Vite-only) where Nitro does not provide the env.
			const userEnvs = (userConfig as { environments?: Record<string, unknown> }).environments
			const userSsr =
				typeof userEnvs?.ssr === 'object' && userEnvs.ssr !== null && !Array.isArray(userEnvs.ssr)
					? userEnvs.ssr
					: {}
			const userSsrDev =
				'dev' in userSsr &&
				typeof (userSsr as { dev?: unknown }).dev === 'object' &&
				(userSsr as { dev?: unknown }).dev !== null &&
				!Array.isArray((userSsr as { dev?: unknown }).dev)
					? ((userSsr as { dev: Record<string, unknown> }).dev ?? {})
					: {}

			const baseViteLogger =
				userConfig.customLogger ??
				createLogger(userConfig.logLevel, { allowClearScreen: userConfig.clearScreen !== false })
			const wrappedLogger = wrapAeroViteLogger(baseViteLogger)
			const ssrHmrLogger = createAeroSsrHmrLogger()
			const userSsrCreate = userSsrDev.createEnvironment as
				| ((
						name: string,
						config: ResolvedConfig,
						ctx: { ws: WebSocketServer },
				  ) => DevEnvironment | Promise<DevEnvironment>)
				| undefined

			function ssrCreateEnvironment(
				name: string,
				config: ResolvedConfig,
				context: { ws: WebSocketServer },
			): DevEnvironment | Promise<DevEnvironment> {
				if (userSsrCreate) {
					return userSsrCreate(name, config, context)
				}
				return createRunnableDevEnvironment(name, config, {
					...context,
					runnerOptions: mergeSsrRunnerOptionsWithHmrLogger(undefined, ssrHmrLogger),
				})
			}

			return {
				base: './',
				customLogger: wrappedLogger,
				resolve: { alias },
				define: {
					'import.meta.env.SITE': JSON.stringify(site),
				},
				environments: {
					...(userEnvs ?? {}),
					ssr: {
						...userSsr,
						dev: {
							...userSsrDev,
							createEnvironment: ssrCreateEnvironment,
						},
					},
				},
				build: createBuildConfig(
					{ resolvePath: state.aliasResult.resolve, dirs: state.options.dirs },
					root,
				),
			}
		},
		configResolved(resolvedConfig) {
			state.config = resolvedConfig
			// Write runtime instance to a real file under .aero so Vite's import-glob allows our patterns (virtual modules require leading '/').
			const dir = path.join(resolvedConfig.root, AERO_DIR)
			mkdirSync(dir, { recursive: true })
			const filePath = path.join(dir, RUNTIME_INSTANCE_FILENAME)
			// Use path relative to .aero/ so SSR (Node) can resolve the runtime when running the generated file.
			const runtimeIndexPath = path.join(path.dirname(state.runtimeInstancePath), 'index.mjs')
			const runtimeImportPath = path.relative(dir, runtimeIndexPath).replace(/\\/g, '/')
			writeFileSync(
				filePath,
				getRuntimeInstanceVirtualSource(
					state.dirs.client,
					runtimeImportPath.startsWith('.') ? runtimeImportPath : './' + runtimeImportPath,
				),
				'utf-8',
			)
			state.generatedRuntimeInstancePath = filePath
		},
	}
}

/** True if filePath is an Aero template under client/pages, client/components, or client/layouts. */
function isAeroTemplateHtml(
	filePath: string,
	root: string,
	dirs: AeroPluginState['dirs'],
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

/**
 * Prefix for import.meta.glob patterns. In virtual modules Vite requires globs to start with '/'
 * (absolute from project root). Uses app-configured client dir so custom dirs (e.g. frontend/) resolve correctly.
 */
function clientGlobPrefix(clientDir: string): string {
	const normalized = clientDir.replace(/\\/g, '/').replace(/^\.\/+/, '')
	return normalized ? `/${normalized}` : '/client'
}

/** Key prefix for all virtual client script ids emitted from one template. */
function clientScriptPrefixForBase(baseName: string): string {
	return CLIENT_SCRIPT_PREFIX + baseName + '.'
}

/** All virtual client script ids belonging to the same template baseName. */
function getClientScriptIdsForBase(
	baseName: string,
	target: Map<string, ScriptEntry>,
): string[] {
	const prefix = clientScriptPrefixForBase(baseName)
	const ids: string[] = []
	for (const id of target.keys()) {
		if (id.startsWith(prefix)) ids.push(id)
	}
	return ids
}

/**
 * Replace the client script entries for one template and report whether content actually changed.
 * Also returns all potentially affected virtual ids (old and new) for module invalidation.
 */
function syncClientScriptsForTemplate(
	parsed: ReturnType<typeof parse>,
	baseName: string,
	target: Map<string, ScriptEntry>,
): { changed: boolean; affectedIds: string[] } {
	const previousIds = getClientScriptIdsForBase(baseName, target)
	const previousEntries = new Map<string, ScriptEntry>()
	for (const id of previousIds) {
		const existing = target.get(id)
		if (existing) previousEntries.set(id, existing)
		target.delete(id)
	}

	if (parsed.clientScripts.length > 0) {
		registerClientScriptsToMap(parsed, baseName, target)
	}

	const nextIds = getClientScriptIdsForBase(baseName, target)
	let changed = previousIds.length !== nextIds.length
	if (!changed) {
		for (const id of nextIds) {
			if (!sameScriptEntry(previousEntries.get(id), target.get(id))) {
				changed = true
				break
			}
		}
	}

	return {
		changed,
		affectedIds: [...new Set([...previousIds, ...nextIds])],
	}
}

/** Turn a compile Effect exit into JS source, or call Vite `error` on failure. */
function compileExitToGeneratedOrReport(
	ctx: { error(payload: unknown): never },
	exit: Exit.Exit<string, AeroCompileError>,
	filePath: string,
	pluginName: string,
): string {
	if (Exit.isSuccess(exit)) return exit.value
	const raw = exitFailureToAeroDiagnostics(exit)
	const merged = enrichDiagnosticsWithSourceFrames(
		raw.map(d => ({
			...d,
			file: d.file ?? d.span?.file ?? filePath,
		})),
	)
	const fields = aeroDiagnosticToViteErrorFields(merged[0]!, pluginName)
	const payload =
		merged.length > 1 ? { ...fields, message: diagnosticsToSingleMessage(merged) } : fields
	ctx.error(payload)
}

/**
 * Virtual module source for the runtime instance with glob patterns using the app's client dir.
 * Ensures template resolution works for custom dirs (e.g. dirs.client === 'frontend').
 * runtimeImportPath: path that resolves to @aero-js/core/runtime from the generated file (e.g. relative to .aero/ for SSR).
 */
function getRuntimeInstanceVirtualSource(
	clientDir: string,
	runtimeImportPath: string = '@aero-js/core/runtime',
): string {
	const prefix = clientGlobPrefix(clientDir)
	const componentsPattern = `${prefix}/components/**/*.html`
	const layoutsPattern = `${prefix}/layouts/*.html`
	const pagesPattern = `${prefix}/pages/**/*.html`
	return `import { Aero } from ${JSON.stringify(runtimeImportPath)}

const instance = globalThis.__AERO_INSTANCE__ || new Aero()
const listeners = globalThis.__AERO_LISTENERS__ || new Set()
const aero = instance

const onUpdate = (cb) => {
	listeners.add(cb)
	return () => listeners.delete(cb)
}
const notify = () => {
	listeners.forEach((cb) => cb())
}

if (!globalThis.__AERO_INSTANCE__) globalThis.__AERO_INSTANCE__ = instance
if (!globalThis.__AERO_LISTENERS__) globalThis.__AERO_LISTENERS__ = listeners

const components = import.meta.glob(${JSON.stringify(componentsPattern)}, { eager: true })
const layouts = import.meta.glob(${JSON.stringify(layoutsPattern)}, { eager: true })
const pages = import.meta.glob(${JSON.stringify(pagesPattern)}, { eager: true })

aero.registerPages(components)
aero.registerPages(layouts)
aero.registerPages(pages)

notify()

if (import.meta.hot) import.meta.hot.accept()

export { aero, onUpdate }
`
}

function createAeroVirtualsPlugin(state: AeroPluginState): Plugin {
	return {
		name: 'vite-plugin-aero-virtuals',
		enforce: 'pre',
		buildStart() {
			if (!state.config) return
			state.clientScripts.clear()
			const contentMap = discoverClientScriptContentMap(state.config.root, state.dirs.client)
			contentMap.forEach((entry, url) => state.clientScripts.set(url, entry))
		},
		async handleHotUpdate(ctx) {
			if (!state.config || state.config.command === 'build') return
			if (!ctx.file.endsWith('.html')) return
			if (!isAeroTemplateHtml(ctx.file, state.config.root, state.dirs)) return

			const code = await ctx.read()
			const parsed = parse(code)

			const relativePath = toPosixRelative(ctx.file, state.config.root)
			const baseName = relativePath.replace(/\.html$/i, '')
			const { changed, affectedIds } = syncClientScriptsForTemplate(
				parsed,
				baseName,
				state.clientScripts,
			)
			if (!changed || affectedIds.length === 0) return

			const invalidated = new Set<any>()
			for (const virtualId of affectedIds) {
				const moduleId = '\0' + virtualId
				const mod =
					ctx.server.moduleGraph.getModuleById(moduleId) ||
					ctx.server.moduleGraph.getModuleById(virtualId)
				if (!mod || invalidated.has(mod)) continue
				ctx.server.moduleGraph.invalidateModule(mod)
				invalidated.add(mod)
			}

			// Module scripts executed via injected <script type="module" src="..."> need a full reload
			// so browser module caching does not keep stale script behavior.
			ctx.server.ws.send({ type: 'full-reload' })
			return []
		},
		async resolveId(id, importer) {
			// In dev: redirect client's runtime instance import to the virtual module.
			// The built instance has empty globs (bundler strips import.meta.glob); the virtual
			// module has app-specific globs so template changes invalidate the client and trigger HMR.
			if (state.config?.command !== 'build') {
				const isRelativeInstanceImport =
					id === './runtime/instance' || id === '../runtime/instance'
				const isFromCore =
					importer &&
					(importer.includes('entry-dev') ||
						importer.includes('@aero-js/core') ||
						importer.includes('/core/'))
				if (isRelativeInstanceImport && isFromCore) {
					return RESOLVED_RUNTIME_INSTANCE_MODULE_ID
				}
				// Fallback: id might resolve to runtime instance (e.g. full path from pre-bundle)
				if (importer && (id.includes('runtime') || id.includes('instance'))) {
					const resolved = await this.resolve(id, importer, { skipSelf: true })
					if (
						resolved?.id &&
						/runtime\/instance\.(m?js|ts)$/.test(resolved.id) &&
						resolved.id.includes('aero')
					) {
						return RESOLVED_RUNTIME_INSTANCE_MODULE_ID
					}
				}
			}

			if (id === RUNTIME_INSTANCE_MODULE_ID) {
				// In dev: use virtual module so load() fires and Vite's SSR transform rewrites exports
				// (Vite 8's AsyncFunction evaluator cannot parse raw ESM export syntax).
				// In build: resolve to real file under .aero so Vite's import-glob has a file context for glob patterns.
				if (state.config?.command === 'build' && state.generatedRuntimeInstancePath) {
					return state.generatedRuntimeInstancePath
				}
				return RESOLVED_RUNTIME_INSTANCE_MODULE_ID
			}

			if (id.startsWith(CLIENT_SCRIPT_PREFIX)) {
				return '\0' + id
			}
			if (id.startsWith('\0' + CLIENT_SCRIPT_PREFIX)) {
				return id
			}

			if (id.startsWith(AERO_HTML_VIRTUAL_PREFIX)) {
				return id
			}

			// Vite 8 may request .html with ?html-proxy&inline-css to extract inline styles; Aero .html are compiled to JS, so serve empty CSS.
			if (id.includes('html-proxy') && id.includes('inline-css')) {
				return AERO_EMPTY_INLINE_CSS_PREFIX + id
			}

			if (id.startsWith('aero:content')) {
				return null
			}

			const resolved = await this.resolve(id, importer, { skipSelf: true })
			if (resolved && resolved.id.endsWith('.html')) {
				// Only in build: resolve Aero template .html to virtual id so vite:build-html never sees them.
				// In dev we keep the real path so Vite's file watcher invalidates the module when the file changes (HMR + fresh SSR).
				if (
					state.config?.command === 'build' &&
					state.aliasResult &&
					isAeroTemplateHtml(resolved.id, state.config.root, state.dirs)
				) {
					return AERO_HTML_VIRTUAL_PREFIX + resolved.id.replace(/\.html$/i, '.aero')
				}
				return resolved
			}

			// Only try id + '.html' for path-like specifiers (relative, absolute, or path aliases like @components/foo).
			// Skip package subpaths: @scope/name/subpath (3+ segments) and any id that resolved into node_modules.
			const isPathLike =
				(id.startsWith('./') ||
					id.startsWith('../') ||
					id.startsWith('/') ||
					(id.startsWith('@') &&
						!id.slice(1).split('/')[0].includes('-') &&
						id.split('/').length < 3)) &&
				!id.includes('.') &&
				!id.startsWith('\0') &&
				!resolved?.id.includes('node_modules')
			if (isPathLike) {
				const resolvedHtml = await this.resolve(id + '.html', importer, {
					skipSelf: true,
				})
				if (resolvedHtml) {
					if (
						state.config?.command === 'build' &&
						state.aliasResult &&
						isAeroTemplateHtml(resolvedHtml.id, state.config.root, state.dirs)
					) {
						return AERO_HTML_VIRTUAL_PREFIX + resolvedHtml.id.replace(/\.html$/i, '.aero')
					}
					return resolvedHtml
				}
			}

			return null
		},
		load(id) {
			if (id === RESOLVED_RUNTIME_INSTANCE_MODULE_ID) {
				return getRuntimeInstanceVirtualSource(state.dirs.client)
			}

			if (id.startsWith(AERO_EMPTY_INLINE_CSS_PREFIX)) {
				return '/* aero: no inline styles */'
			}

			if (id.startsWith(AERO_HTML_VIRTUAL_PREFIX)) {
				const filePath = id.slice(AERO_HTML_VIRTUAL_PREFIX.length).replace(/\.aero$/i, '.html')
				if (!state.config || !state.aliasResult) return null
				const resolvedConfig = state.config
				const resolvedAlias = state.aliasResult
				// So Vite invalidates this virtual module when the source .html changes (HMR).
				this.addWatchFile(filePath)
				const exit = Effect.runSyncExit(
					htmlCompileTry(filePath, () => {
						const code = readFileSync(filePath, 'utf-8')
						const parsed = parse(code)
						const relativePath = toPosixRelative(filePath, resolvedConfig.root)
						const baseName = relativePath.replace(/\.html$/i, '')
						syncClientScriptsForTemplate(parsed, baseName, state.clientScripts)
						for (let i = 0; i < parsed.clientScripts.length; i++) {
							parsed.clientScripts[i].content = getClientScriptVirtualUrl(
								baseName,
								i,
								parsed.clientScripts.length,
							)
						}
						return compileTemplate(
							code,
							{
								root: resolvedConfig.root,
								clientScripts: parsed.clientScripts,
								blockingScripts: parsed.blockingScripts,
								inlineScripts: parsed.inlineScripts,
								resolvePath: resolvedAlias.resolve,
								importer: filePath,
							},
							parsed,
						)
					}),
				)
				const generated = compileExitToGeneratedOrReport(
					this,
					exit,
					filePath,
					'vite-plugin-aero-virtuals',
				)
				return { code: generated, map: null }
			}

			if (id.startsWith('\0' + CLIENT_SCRIPT_PREFIX)) {
				const virtualId = id.slice(1)
				const entry = state.clientScripts.get(virtualId)
				if (!entry) return ''

				if (entry.passDataExpr) {
					const keys = extractObjectKeys(entry.passDataExpr)
					if (keys.length > 0) {
						const preamble = `var __aero_data=(typeof window!=='undefined'&&window.__aero_data_next!==undefined)?window.__aero_data_next:{};if(typeof window!=='undefined')delete window.__aero_data_next;const { ${keys.join(', ')} } = __aero_data;\n`
						return preamble + entry.content
					}
				}

				return entry.content
			}
			return null
		},
	}
}

function createAeroTransformPlugin(state: AeroPluginState): Plugin {
	return {
		name: 'vite-plugin-aero-transform',
		enforce: 'pre',
		transform(code, id) {
			if (id.startsWith(AERO_HTML_VIRTUAL_PREFIX)) return null
			if (!id.endsWith('.html')) return null
			if (!state.config || !state.aliasResult) return null
			const resolvedConfig = state.config
			const resolvedAlias = state.aliasResult

			const exit = Effect.runSyncExit(
				htmlCompileTry(id, () => {
					const parsed = parse(code)

					const relativePath = toPosixRelative(id, resolvedConfig.root)
					const baseName = relativePath.replace(/\.html$/i, '')
					syncClientScriptsForTemplate(parsed, baseName, state.clientScripts)
					if (parsed.clientScripts.length > 0) {
						for (let i = 0; i < parsed.clientScripts.length; i++) {
							parsed.clientScripts[i].content = getClientScriptVirtualUrl(
								baseName,
								i,
								parsed.clientScripts.length,
							)
						}
					}

					return compileTemplate(
						code,
						{
							root: resolvedConfig.root,
							clientScripts: parsed.clientScripts,
							blockingScripts: parsed.blockingScripts,
							inlineScripts: parsed.inlineScripts,
							resolvePath: resolvedAlias.resolve,
							importer: id,
						},
						parsed,
					)
				}),
			)
			const generated = compileExitToGeneratedOrReport(
				this,
				exit,
				id,
				'vite-plugin-aero-transform',
			)
			return {
				code: generated,
				map: null,
			}
		},
	}
}

function createAeroSsrPlugin(state: AeroPluginState): Plugin {
	return {
		name: 'vite-plugin-aero-ssr',
		configureServer(server: ViteDevServer) {
			server.middlewares.use(async (req, res, next) => {
				if (!req.url) return next()
				if (req.method && req.method.toUpperCase() !== 'GET') return next()

				const acceptsHtml = req.headers.accept?.includes('text/html')
				if (!acceptsHtml) return next()

				const pathname = req.url.split('?')[0] || '/'
				if (
					pathname.startsWith(state.apiPrefix) ||
					pathname.startsWith('/@fs') ||
					pathname.startsWith('/@id')
				) {
					return next()
				}

				const ext = path.extname(pathname)
				if (ext && ext !== '.html') return next()

				// Apply config redirects first (exact path match)
				const redirects = state.options.redirects
				if (redirects?.length) {
					for (const rule of redirects) {
						if (pathname === rule.from) {
							res.statusCode = rule.status ?? 302
							res.setHeader('Location', rule.to)
							res.end()
							return
						}
					}
				}

				let renderPageNameForDiag = resolvePageName(req.url)
				try {
					const pageName = resolvePageName(req.url)
					renderPageNameForDiag = pageName
					const ssrEnv = server.environments.ssr
					if (!isRunnableDevEnvironment(ssrEnv)) {
						throw new Error('[aero] SSR environment must be runnable')
					}
					const mod = await ssrEnv.runner.import(RUNTIME_INSTANCE_MODULE_ID)

					const requestUrl = new URL(req.url, 'http://localhost')
					const requestHeaders = new Headers()
					for (const [name, value] of Object.entries(req.headers)) {
						if (value === undefined) continue
						if (Array.isArray(value)) {
							for (const item of value) requestHeaders.append(name, item)
							continue
						}
						requestHeaders.set(name, value)
					}

					const request = new Request(requestUrl.toString(), {
						method: req.method || 'GET',
						headers: requestHeaders,
					})

					let renderPageName = pageName
					let renderInput: AeroRenderInput = {
						url: requestUrl,
						request,
						routePath: pathname,
						site: state.options.site?.url,
					}

					// Run middleware (redirects, rewrites, custom response)
					const middleware = state.options.middleware
					if (middleware?.length) {
						const ctx = {
							url: requestUrl,
							request,
							routePath: pathname,
							pageName,
							site: state.options.site?.url,
						}
						for (const handler of middleware) {
							const result: AeroMiddlewareResult = await Promise.resolve(handler(ctx))
							if (result && 'redirect' in result) {
								res.statusCode = result.redirect.status ?? 302
								res.setHeader('Location', result.redirect.url)
								res.end()
								return
							}
							if (result && 'response' in result) {
								res.statusCode = result.response.status
								result.response.headers.forEach((v: string, k: string) => res.setHeader(k, v))
								const body = await result.response.arrayBuffer()
								res.end(Buffer.from(body))
								return
							}
							if (result && 'rewrite' in result) {
								if (result.rewrite.pageName !== undefined) {
									renderPageName = result.rewrite.pageName
									renderPageNameForDiag = renderPageName
								}
								const { pageName: _pn, ...rest } = result.rewrite
								renderInput = { ...renderInput, ...rest }
							}
						}
					}

					let rendered = await mod.aero.render(renderPageName, renderInput)

					if (rendered === null) {
						res.statusCode = 404
						rendered = await mod.aero.render('404', renderInput)
					}

					if (rendered === null) {
						res.statusCode = 404
						res.setHeader('Content-Type', 'text/html; charset=utf-8')
						res.end('<h1>404 — Not Found</h1>')
						return
					}

					rendered = addDoctype(rendered)

					const transformed = await server.transformIndexHtml(req.url, rendered)
					res.setHeader('Content-Type', 'text/html; charset=utf-8')
					res.end(transformed)
				} catch (err) {
					const root = state.config?.root
					const pageTemplateHint =
						root && renderPageNameForDiag
							? path.join(root, state.dirs.client, 'pages', `${renderPageNameForDiag}.html`)
							: undefined
					const diagnostics = enrichDiagnosticsWithSourceFrames(
						unknownToAeroDiagnostics(err, pageTemplateHint ? { file: pageTemplateHint } : {}),
					)
					server.config.logger.error(
						'\n' + formatDiagnosticsTerminal(diagnostics) + '\n',
					)
					const devDetails = server.config.mode === 'development'
					if (devDetails) {
						res.statusCode = 500
						res.setHeader('Content-Type', 'text/html; charset=utf-8')
						res.setHeader(
							AERO_DIAGNOSTICS_HTTP_HEADER,
							encodeDiagnosticsHeaderValue(diagnostics),
						)
						res.end(buildDevSsrErrorHtml(diagnostics))
						return
					}
					res.statusCode = 500
					res.setHeader('Content-Type', 'text/html; charset=utf-8')
					res.end(
						'<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body><h1>Internal Server Error</h1></body></html>',
					)
				}
			})
		},
	}
}

/**
 * Aero Vite plugin factory. Returns an array of plugins: config, virtuals, transform, SSR,
 * static-build, image optimizer, and optionally Nitro (serve only).
 * HMR for templates and content is handled by Vite's dependency graph when the app uses a single
 * client entry that imports @aero-js/core and calls aero.mount().
 *
 * @param options - AeroOptions (server, apiPrefix, dirs). Server can be disabled at runtime via AERO_SERVER=false.
 * @returns PluginOption[] to pass to Vite's plugins array.
 */
export function aero(options: AeroOptions = {}): PluginOption[] {
	const dirs = resolveDirs(options.dirs)
	const apiPrefix = options.apiPrefix || DEFAULT_API_PREFIX
	const enableNitro = options.server === true && process.env.AERO_SERVER !== 'false'

	const runtimeInstanceMjsPath = fileURLToPath(
		new URL('../runtime/instance.mjs', import.meta.url),
	)
	const runtimeInstanceJsPath = fileURLToPath(
		new URL('../runtime/instance.js', import.meta.url),
	)
	const runtimeInstanceTsPath = fileURLToPath(
		new URL('../runtime/instance.ts', import.meta.url),
	)
	const runtimeInstancePath = existsSync(runtimeInstanceMjsPath)
		? runtimeInstanceMjsPath
		: existsSync(runtimeInstanceJsPath)
			? runtimeInstanceJsPath
			: runtimeInstanceTsPath

	const state: AeroPluginState = {
		config: null,
		aliasResult: null,
		clientScripts: new Map<string, ScriptEntry>(),
		runtimeInstancePath,
		generatedRuntimeInstancePath: null,
		dirs,
		apiPrefix,
		options,
	}

	const aeroConfigPlugin = createAeroConfigPlugin(state)
	const aeroVirtualsPlugin = createAeroVirtualsPlugin(state)
	const aeroTransformPlugin = createAeroTransformPlugin(state)
	const aeroSsrPlugin = createAeroSsrPlugin(state)

	/** Plugins needed for static build (resolve, load, transform); no SSR/HMR. */
	const aeroCorePlugins: Plugin[] = [aeroConfigPlugin, aeroVirtualsPlugin, aeroTransformPlugin]

	const staticBuildPlugin: Plugin = {
		name: 'vite-plugin-aero-static',
		apply: 'build',
		async closeBundle() {
			// Project root (site/app directory: e.g. examples/kitchen-sink or @aero-js/create generated project), not monorepo root
			const root = state.config!.root
			const outDir = state.config!.build.outDir
			const shouldMinifyHtml =
				state.config!.build.minify !== false &&
				typeof import.meta !== 'undefined' &&
				import.meta.env?.PROD
			const staticPlugins = options.staticServerPlugins?.length
				? [...aeroCorePlugins, ...options.staticServerPlugins]
				: aeroCorePlugins
			try {
				await renderStaticPages(
					{
						root,
						resolvePath: state.aliasResult!.resolve,
						dirs: options.dirs,
						apiPrefix,
						vitePlugins: staticPlugins,
						minify: shouldMinifyHtml,
						site: options.site?.url,
						redirects: options.redirects,
						resolvedConfig: state.config!,
					},
					outDir,
				)
			} catch (err) {
				const diagnostics = enrichDiagnosticsWithSourceFrames(unknownToAeroDiagnostics(err))
				state.config!.logger.error(
					'\n' + formatDiagnosticsTerminal(diagnostics) + '\n',
				)
				process.exitCode = exitCodeForThrown(err)
				throw err
			}
			if (enableNitro) {
				const configCwd = writeGeneratedNitroConfig(
					root,
					dirs.server,
					options.redirects,
					dirs.dist,
				)
				try {
					await runNitroBuild(root, configCwd)
				} catch (err) {
					const diagnostics = enrichDiagnosticsWithSourceFrames(unknownToAeroDiagnostics(err))
					state.config!.logger.error(
						'\n' + formatDiagnosticsTerminal(diagnostics) + '\n',
					)
					process.exitCode = AERO_EXIT_NITRO
					throw err
				}
			}
		},
	}

	const plugins: PluginOption[] = [
		aeroConfigPlugin,
		aeroVirtualsPlugin,
		aeroTransformPlugin,
		aeroSsrPlugin,
		staticBuildPlugin,
		ViteImageOptimizer({
			exclude: undefined,
			include: undefined,
			includePublic: true,
			logStats: true,
			ansiColors: true,
			svg: {
				multipass: true,
				plugins: [
					{
						name: 'preset-default',
						params: {
							overrides: {
								cleanupNumericValues: false,
							},
							cleanupIDs: {
								minify: false,
								remove: false,
							},
							convertPathData: false,
						},
					},
				],
			},
			png: { quality: 80 },
			jpeg: { quality: 80 },
			jpg: { quality: 80 },
			tiff: { quality: 80 },
			gif: {},
			webp: { lossless: true },
			avif: { lossless: true },
		}),
	]

	if (enableNitro) {
		const rawNitroPlugins = nitro({ serverDir: dirs.server })
		const nitroPlugins = Array.isArray(rawNitroPlugins) ? rawNitroPlugins : [rawNitroPlugins]
		for (const nitroPlugin of nitroPlugins) {
			if (!nitroPlugin || typeof nitroPlugin !== 'object') continue
			const originalApply = nitroPlugin.apply
			plugins.push({
				...nitroPlugin,
				apply(pluginConfig, env) {
					if (env.command !== 'serve') return false
					if ((env as { isPreview?: boolean }).isPreview) return false
					if (typeof originalApply === 'function') {
						return originalApply(pluginConfig, env)
					}
					if (originalApply) return originalApply === 'serve'
					return true
				},
			})
		}
	}

	return plugins
}
