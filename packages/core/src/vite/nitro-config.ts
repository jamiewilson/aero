/**
 * Aero Nitro config: load project config, merge plugins, write generated `.aero/nitro.config.mjs`.
 */

import type { RedirectRule } from '../types'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { redirectsToRouteRules } from '../utils/redirects'
import { loadProjectModule } from '../utils/load-project-module'
import { toPosix } from '../utils/path'
import { emitGeneratedNitroConfigContent } from './emit-generated-nitro-config'
import {
	normalizeAlias,
	normalizeAssetEntries,
	normalizeImports,
	normalizeModules,
	normalizePlugins,
	normalizeRelativeModulePath,
	normalizeScanDirs,
	normalizeTasks,
} from './nitro-config-normalize'

const NITRO_CONFIG_NAMES = [
	'nitro.config.ts',
	'nitro.config.mts',
	'nitro.config.cts',
	'nitro.config.js',
	'nitro.config.mjs',
	'nitro.config.cjs',
] as const

/** Package export id (docs / identity). Nitro plugins must use {@link resolveAeroNitroRuntimePluginPath}. */
export const AERO_NITRO_RUNTIME_PLUGIN = '@aero-js/core/nitro/runtime-plugin'

const requireFromHere = createRequire(import.meta.url)

/**
 * Absolute filesystem path to Aero's Nitro runtime plugin.
 *
 * Nitro resolves bare/package plugin ids relative to the app root (e.g.
 * `kitchen-sink/@aero-js/core/...`), so the Vite/dev and generated configs must
 * pass a real file path.
 */
export function resolveAeroNitroRuntimePluginPath(): string {
	try {
		return toPosix(requireFromHere.resolve(AERO_NITRO_RUNTIME_PLUGIN))
	} catch {
		const mjs = fileURLToPath(new URL('../nitro/runtime-plugin.mjs', import.meta.url))
		if (existsSync(mjs)) return toPosix(mjs)
		return toPosix(fileURLToPath(new URL('../nitro/runtime-plugin.ts', import.meta.url)))
	}
}

function isAeroNitroRuntimePluginEntry(entry: string): boolean {
	if (entry === AERO_NITRO_RUNTIME_PLUGIN) return true
	return /[/\\]nitro[/\\]runtime-plugin\.(mjs|js|ts)$/.test(entry)
}

type NitroConfigObject = Record<string, unknown>

type LoadProjectNitroConfigDetailedResult =
	| { ok: true; filePath: string; config: NitroConfigObject }
	| { ok: false; reason: 'not-found' }
	| { ok: false; reason: 'invalid-export'; filePath: string }
	| { ok: false; reason: 'load-error'; filePath: string; error: unknown }

interface GeneratedNitroConfigResult {
	aeroDir: string
	filePath: string
	content: string
	conflictingRedirects: string[]
	userConfigFile: string | null
}

interface GeneratedNitroConfigOptions {
	root: string
	serverDir: string
	redirects?: RedirectRule[]
	distDir: string
	apiPrefix: string
	warn?: (message: string) => void
}

/** Prepend Aero's runtime plugin; keep user plugins after. */
export function mergeAeroNitroPlugins(userPlugins: unknown): string[] {
	const aeroPlugin = resolveAeroNitroRuntimePluginPath()
	const rest = Array.isArray(userPlugins)
		? userPlugins.filter(
				(entry): entry is string => typeof entry === 'string' && !isAeroNitroRuntimePluginEntry(entry)
			)
		: []
	return [aeroPlugin, ...rest]
}

/**
 * Plugins for Vite-dev Nitro (`nitro/vite`): Aero invariant + project nitro.config plugins.
 *
 * Vite-dev does not use `.aero/nitro.config.mjs`; overrides must include the merged list
 * so c12 does not drop either Aero or user plugins.
 */
export function resolveAeroNitroPluginsForVite(root: string): string[] {
	const userConfig = loadProjectNitroConfigDetailed(root)
	if (!userConfig.ok) return mergeAeroNitroPlugins(undefined)

	const configDir = path.dirname(userConfig.filePath)
	const normalized = normalizePlugins(userConfig.config.plugins, configDir)
	return mergeAeroNitroPlugins(normalized)
}

export function findProjectNitroConfigFile(root: string): string | null {
	for (const name of NITRO_CONFIG_NAMES) {
		const filePath = path.join(root, name)
		if (existsSync(filePath)) return filePath
	}
	return null
}

export function loadProjectNitroConfigDetailed(root: string): LoadProjectNitroConfigDetailedResult {
	const filePath = findProjectNitroConfigFile(root)
	if (!filePath) return { ok: false, reason: 'not-found' }

	try {
		const config = loadProjectModule<NitroConfigObject>(root, './' + path.basename(filePath))
		if (config && typeof config === 'object' && !Array.isArray(config)) {
			return { ok: true, filePath, config }
		}
		return { ok: false, reason: 'invalid-export', filePath }
	} catch (error) {
		return { ok: false, reason: 'load-error', filePath, error }
	}
}

function toRelativeModulePath(fromDir: string, targetFile: string): string {
	const relativePath = path.relative(fromDir, targetFile)
	return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

export function writeGeneratedNitroConfig({
	root,
	serverDir,
	redirects,
	distDir,
	apiPrefix,
	warn,
}: GeneratedNitroConfigOptions): GeneratedNitroConfigResult {
	const aeroDir = path.join(root, '.aero')
	mkdirSync(aeroDir, { recursive: true })

	const userConfig = loadProjectNitroConfigDetailed(root)
	const userConfigFile = userConfig.ok ? userConfig.filePath : findProjectNitroConfigFile(root)
	const userRouteRules =
		userConfig.ok &&
		userConfig.config.routeRules &&
		typeof userConfig.config.routeRules === 'object' &&
		!Array.isArray(userConfig.config.routeRules)
			? (userConfig.config.routeRules as Record<string, unknown>)
			: {}

	if (!userConfig.ok && userConfig.reason === 'load-error') {
		warn?.(
			`[aero] Failed to inspect ${path.basename(userConfig.filePath)} for redirect conflicts. Nitro will still extend it during build.`
		)
	}
	if (!userConfig.ok && userConfig.reason === 'invalid-export') {
		warn?.(
			`[aero] ${path.basename(userConfig.filePath)} does not export an object. Redirect conflict detection was skipped.`
		)
	}

	const aeroRouteRules = redirectsToRouteRules(redirects ?? [])
	const conflictingRedirects = Object.keys(aeroRouteRules).filter(route => route in userRouteRules)
	const effectiveAeroRouteRules = Object.fromEntries(
		Object.entries(aeroRouteRules).filter(([route]) => !conflictingRedirects.includes(route))
	)

	if (conflictingRedirects.length > 0) {
		warn?.(
			`[aero] Skipping redirect-generated Nitro routeRules that already exist in ${path.basename(userConfigFile ?? 'nitro.config')}: ${conflictingRedirects.join(', ')}`
		)
	}

	const replace = {
		'process.env.AERO_DIST': JSON.stringify(distDir),
		'process.env.AERO_API_PREFIX': JSON.stringify(apiPrefix),
	}

	const serverScanDir = path.join(root, serverDir)
	const userConfigDir = userConfigFile === null ? null : path.dirname(userConfigFile)
	const importPath =
		userConfigFile === null
			? null
			: toRelativeModulePath(aeroDir, userConfigFile).replace(/\\/g, '/')
	const normalizedUserScanDirs =
		userConfig.ok && userConfigDir !== null
			? normalizeScanDirs(userConfig.config.scanDirs, userConfigDir)
			: []
	const normalizedUserPlugins =
		userConfig.ok && userConfigDir !== null
			? normalizePlugins(userConfig.config.plugins, userConfigDir)
			: undefined
	const normalizedUserTasks =
		userConfig.ok && userConfigDir !== null
			? normalizeTasks(userConfig.config.tasks, userConfigDir)
			: undefined
	const normalizedUserModules =
		userConfig.ok && userConfigDir !== null
			? normalizeModules(userConfig.config.modules, userConfigDir)
			: undefined
	const normalizedUserErrorHandler =
		userConfig.ok && userConfigDir !== null
			? normalizeRelativeModulePath(userConfig.config.errorHandler, userConfigDir)
			: undefined
	const normalizedUserImports =
		userConfig.ok && userConfigDir !== null
			? normalizeImports(userConfig.config.imports, userConfigDir)
			: undefined
	const normalizedUserAlias =
		userConfig.ok && userConfigDir !== null
			? normalizeAlias(userConfig.config.alias, userConfigDir)
			: undefined
	const normalizedUserServerAssets =
		userConfig.ok && userConfigDir !== null
			? normalizeAssetEntries(userConfig.config.serverAssets, userConfigDir)
			: undefined
	const normalizedUserPublicAssets =
		userConfig.ok && userConfigDir !== null
			? normalizeAssetEntries(userConfig.config.publicAssets, userConfigDir)
			: undefined
	const normalizedUserServerEntry =
		userConfig.ok && userConfigDir !== null
			? normalizeRelativeModulePath(userConfig.config.serverEntry, userConfigDir)
			: undefined

	const aeroPlugins = mergeAeroNitroPlugins(normalizedUserPlugins)

	const content = emitGeneratedNitroConfigContent({
		root,
		serverScanDir,
		aeroPlugins,
		effectiveAeroRouteRules,
		replace,
		importPath,
		userConfigOk: userConfig.ok,
		normalizedUserScanDirs,
		normalizedUserTasks,
		normalizedUserModules,
		normalizedUserErrorHandler,
		normalizedUserImports,
		normalizedUserAlias,
		normalizedUserServerAssets,
		normalizedUserPublicAssets,
		normalizedUserServerEntry,
	})

	const filePath = path.join(aeroDir, 'nitro.config.mjs')
	writeFileSync(filePath, content)

	return {
		aeroDir,
		filePath,
		content,
		conflictingRedirects,
		userConfigFile,
	}
}
