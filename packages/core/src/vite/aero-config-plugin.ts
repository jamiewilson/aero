/**
 * Aero Vite config plugin: aliases, SSR env, build inputs, generated .aero artifacts.
 */

import type {
	DevEnvironment,
	Plugin,
	ResolvedConfig,
	WebSocketServer,
} from 'vite'
import { createLogger, createRunnableDevEnvironment } from 'vite'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'path'
import { loadTsconfigAliases, mergeWithDefaultAliases } from '../utils/aliases'
import {
	TemplateDiscovery,
	createBuildConfig,
	discoverReactivePagePaths,
	getRuntimeInstanceModuleSource,
} from './build'
import { writeRouteManifestGenerated } from '../routing/route-manifest'
import { writeRouteTypesGenerated } from '../routing/route-typegen'
import { writeSnippetTypesGenerated } from '../snippet-typegen'
import {
	createAeroSsrHmrLogger,
	mergeSsrRunnerOptionsWithHmrLogger,
	wrapAeroViteLogger,
} from './aero-vite-logger'
import { getStateBindingsRegistryModuleSource } from './state-bindings-registry'
import { STATE_BINDINGS_REGISTRY_FILENAME } from './defaults'
import type { AeroPluginState } from './plugin-state'

const require = createRequire(import.meta.url)

const AERO_DIR = '.aero'
/** Filename for the generated runtime instance (uses app dirs for globs); written under .aero so Vite treats it as a real module. */
const RUNTIME_INSTANCE_FILENAME = 'runtime-instance.mjs'

export function createAeroConfigPlugin(state: AeroPluginState): Plugin {
	return {
		name: 'vite-plugin-aero-config',
		enforce: 'pre',
		config(userConfig, env) {
			const root = userConfig.root || process.cwd()
			state.templateDiscovery = new TemplateDiscovery(root, state.dirs.client)
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
						ctx: { ws: WebSocketServer }
				  ) => DevEnvironment | Promise<DevEnvironment>)
				| undefined

			function ssrCreateEnvironment(
				name: string,
				config: ResolvedConfig,
				context: { ws: WebSocketServer }
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
					'import.meta.env.AERO_HYPERMEDIA': JSON.stringify(state.options.hypermedia === true),
					'import.meta.env.AERO_REACTIVITY': JSON.stringify(state.options.reactivity === true),
				},
				environments: {
					...userEnvs,
					ssr: {
						...userSsr,
						dev: {
							...userSsrDev,
							createEnvironment: ssrCreateEnvironment,
						},
					},
				},
				build: createBuildConfig(
					{
						resolvePath: state.aliasResult.resolve,
						dirs: state.options.dirs,
						reactivity: state.options.reactivity,
					},
					root,
					state.templateDiscovery
				),
			}
		},
		configResolved(resolvedConfig) {
			state.config = resolvedConfig
			const { manifest } = writeRouteManifestGenerated(resolvedConfig.root, state.dirs.client)
			writeRouteTypesGenerated(resolvedConfig.root, manifest)
			writeSnippetTypesGenerated(resolvedConfig.root)
			// Write runtime instance to a real file under .aero so Vite's import-glob allows our patterns (virtual modules require leading '/').
			const dir = path.join(resolvedConfig.root, AERO_DIR)
			mkdirSync(dir, { recursive: true })
			const filePath = path.join(dir, RUNTIME_INSTANCE_FILENAME)
			// Use path relative to .aero/ so SSR (Node) can resolve the runtime when running the generated file.
			const runtimeIndexPath = path.join(path.dirname(state.runtimeInstancePath), 'index.mjs')
			const runtimeImportPath = path.relative(dir, runtimeIndexPath).replace(/\\/g, '/')
			writeFileSync(
				filePath,
				getRuntimeInstanceModuleSource(
					resolvedConfig.root,
					state.dirs.client,
					runtimeImportPath.startsWith('.') ? runtimeImportPath : './' + runtimeImportPath
				),
				'utf-8'
			)
			state.generatedRuntimeInstancePath = filePath

			const reactivePages =
				state.options.reactivity === true
					? discoverReactivePagePaths(resolvedConfig.root, state.dirs.client)
					: []
			const stateBindingsRegistryPath = path.join(dir, STATE_BINDINGS_REGISTRY_FILENAME)
			writeFileSync(
				stateBindingsRegistryPath,
				getStateBindingsRegistryModuleSource(resolvedConfig.root, reactivePages),
				'utf-8'
			)
			state.generatedStateBindingsRegistryPath = stateBindingsRegistryPath
		},
	}
}
