/**
 * Aero Vite static build plugin: prerender pages after closeBundle; optional Nitro build.
 */

import type { AeroOptions } from '../types'
import type { Plugin } from 'vite'
import { spawn } from 'node:child_process'
import { renderStaticPages } from './build'
import { writeGeneratedNitroConfig } from './nitro-config'
import { createStaticBuildReportingService } from './static-build-reporting'
import { requireAliasResult, requireResolvedConfig, type AeroPluginState } from './plugin-state'

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

export function createAeroStaticBuildPlugin(
	state: AeroPluginState,
	opts: {
		pluginOptions: Omit<AeroOptions, 'content'>
		apiPrefix: string
		dirs: AeroPluginState['dirs']
		enableNitro: boolean
		aeroCorePlugins: Plugin[]
	}
): Plugin {
	const { pluginOptions, apiPrefix, dirs, enableNitro, aeroCorePlugins } = opts

	return {
		name: 'vite-plugin-aero-static',
		apply: 'build',
		buildEnd(error) {
			if (error) state.staticBuildFailed = true
		},
		async closeBundle() {
			if (state.staticBuildFailed) return
			// Project root (site/app directory: e.g. examples/kitchen-sink or @aero-js/create generated project), not monorepo root
			const resolvedConfig = requireResolvedConfig(state)
			const aliasResult = requireAliasResult(state)
			const root = resolvedConfig.root
			const outDir = resolvedConfig.build.outDir
			const shouldMinifyHtml =
				resolvedConfig.build.minify !== false &&
				typeof import.meta !== 'undefined' &&
				import.meta.env?.PROD
			const staticPlugins = pluginOptions.staticServerPlugins?.length
				? [...aeroCorePlugins, ...pluginOptions.staticServerPlugins]
				: aeroCorePlugins
			const reporting = createStaticBuildReportingService()
			try {
				await renderStaticPages(
					{
						root,
						resolvePath: aliasResult.resolve,
						dirs: pluginOptions.dirs,
						apiPrefix,
						vitePlugins: staticPlugins,
						minify: shouldMinifyHtml,
						site: pluginOptions.site?.url,
						redirects: pluginOptions.redirects,
						resolvedConfig,
					},
					outDir
				)
			} catch (err) {
				reporting.reportPrerenderFailure(err, resolvedConfig.logger)
			}
			if (enableNitro) {
				const { aeroDir } = writeGeneratedNitroConfig({
					root,
					serverDir: dirs.server,
					redirects: pluginOptions.redirects,
					distDir: dirs.dist,
					apiPrefix,
					warn: message => resolvedConfig.logger.warn(message),
				})
				try {
					await runNitroBuild(root, aeroDir)
				} catch (err) {
					reporting.reportNitroFailure(err, resolvedConfig.logger)
				}
			}
		},
	}
}
