/**
 * Entry globs and template paths for static analyzers (Fallow, knip, etc.) that need the same roots
 * as the Aero Vite plugin without evaluating Vite.
 */
import path from 'node:path'
import { discoverRuntimeTemplatePaths, resolveDirs } from '@aero-js/core/vite'
import { loadAeroConfig } from './loadAeroConfig'
import type { AeroConfig } from './types'

function resolveLoadedConfig(root: string): AeroConfig {
	const loaded = loadAeroConfig(root)
	if (loaded === null) return {}
	if (typeof loaded === 'function') {
		return loaded({ command: 'build', mode: 'production' })
	}
	return loaded
}

/** Strip leading `./` and trailing slashes for glob segments. */
function toGlobDirSegment(dir: string): string {
	return dir.replace(/^\.\//, '').replace(/\/$/, '').split(path.sep).join('/')
}

/**
 * Suggested {@link https://github.com/fallow-rs/fallow | Fallow} `entry` globs for a project, derived
 * from `aero.config` and the same directory rules as the Vite runtime instance.
 *
 * @param root - Project root (directory containing `aero.config.*` when present).
 * @param config - Optional resolved config; when omitted, loads `aero.config` from `root`.
 */
export function getAeroAnalyzerEntryGlobs(root: string, config?: AeroConfig): string[] {
	const c = config ?? resolveLoadedConfig(root)
	const dirs = resolveDirs(c.dirs)
	const client = toGlobDirSegment(dirs.client)
	const server = toGlobDirSegment(dirs.server)
	return [
		'aero.config.ts',
		'aero.config.js',
		'aero.config.mjs',
		'vite.config.ts',
		'vite.config.mts',
		'content.config.ts',
		'nitro.config.ts',
		'server.ts',
		`${client}/pages/**/*.html`,
		`${client}/layouts/*.html`,
		`${client}/components/**/*.html`,
		`${client}/assets/**/*.ts`,
		`${client}/assets/**/*.css`,
		`${client}/assets/**/*.js`,
		`${server}/**/*.ts`,
		'content/**/*.ts',
		'lib/**/*.ts',
		'plugins/**/*.ts',
		'tasks/**/*.ts',
		'public/**/*.js',
	]
}

/**
 * Lists discovered HTML template paths (posix, relative to `root`), matching
 * {@link discoverRuntimeTemplatePaths} / the generated runtime instance.
 *
 * @param root - Project root.
 * @param config - Optional resolved config; when omitted, loads `aero.config` from `root`.
 */
export function listAeroTemplatePaths(
	root: string,
	config?: AeroConfig
): { components: string[]; layouts: string[]; pages: string[] } {
	const c = config ?? resolveLoadedConfig(root)
	const dirs = resolveDirs(c.dirs)
	const rootAbs = path.resolve(root)
	const abs = discoverRuntimeTemplatePaths(rootAbs, dirs.client)
	const rel = (p: string) => path.relative(rootAbs, p).split(path.sep).join('/')
	return {
		components: abs.components.map(rel),
		layouts: abs.layouts.map(rel),
		pages: abs.pages.map(rel),
	}
}
