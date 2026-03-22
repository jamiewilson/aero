/**
 * `aero check` — validate aero config, content collections, and template compilation without starting a server.
 */
import type { AeroConfig, AeroConfigFunction } from '@aero-js/config'
import { loadAeroConfig } from '@aero-js/config'
import {
	contentSchemaIssuesToAeroDiagnostics,
	loadAllCollections,
	loadContentConfigFileSync,
} from '@aero-js/content'
import { initProcessor } from '@aero-js/content/processor'
import { compileTemplate } from '@aero-js/core/compile-check'
import type { AeroDiagnostic } from '@aero-js/core/diagnostics'
import {
	exitCodeForDiagnostics,
	formatDiagnosticsTerminal,
	unknownToAeroDiagnostics,
} from '@aero-js/core/diagnostics'
import {
	loadTsconfigAliases,
	mergeWithDefaultAliases,
	resolveDirs,
} from '@aero-js/core/utils/aliases'
import fs from 'node:fs'
import path from 'node:path'

function resolveAeroConfigObject(loaded: AeroConfig | AeroConfigFunction | null): AeroConfig {
	if (!loaded) return {}
	if (typeof loaded === 'function') {
		return loaded({ command: 'build', mode: 'production' })
	}
	return loaded
}

function contentConfigPathFromAero(root: string, aero: AeroConfig): string {
	const c = aero.content
	if (c === true || c === undefined || c === false) {
		return 'content.config.ts'
	}
	return c.config ?? 'content.config.ts'
}

function shouldRunContentCheck(aero: AeroConfig, root: string, relPath: string): boolean {
	if (aero.content === true) return true
	if (typeof aero.content === 'object' && aero.content) return true
	const abs = path.resolve(root, relPath)
	return fs.existsSync(abs)
}

function walkHtmlFiles(dir: string): string[] {
	if (!fs.existsSync(dir)) return []
	const files: string[] = []
	for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, item.name)
		if (item.isDirectory()) {
			files.push(...walkHtmlFiles(fullPath))
			continue
		}
		if (item.isFile() && item.name.endsWith('.html')) {
			files.push(fullPath)
		}
	}
	return files
}

function templateDirs(root: string, clientRel: string): string[] {
	const base = path.join(root, clientRel)
	return [path.join(base, 'pages'), path.join(base, 'components'), path.join(base, 'layouts')]
}

/**
 * Run validation checks for an Aero project directory.
 *
 * @returns Exit code `0` when clean; otherwise {@link exitCodeForDiagnostics} (10–14) from the primary error, matching static build buckets.
 */
export async function runAeroCheck(root: string): Promise<number> {
	const diagnostics: AeroDiagnostic[] = []
	let loadedRaw: ReturnType<typeof loadAeroConfig> = null
	try {
		loadedRaw = loadAeroConfig(root)
	} catch (err) {
		diagnostics.push(...unknownToAeroDiagnostics(err))
	}
	const aero = resolveAeroConfigObject(loadedRaw)

	const dirs = resolveDirs(aero.dirs)
	const mergedAliases = mergeWithDefaultAliases(loadTsconfigAliases(root), root, dirs)
	const resolvePath = mergedAliases.resolve

	const contentRel = contentConfigPathFromAero(root, aero)
	if (shouldRunContentCheck(aero, root, contentRel)) {
		const contentLoad = loadContentConfigFileSync(root, contentRel)
		if (!contentLoad.ok) {
			if (contentLoad.reason === 'missing' && aero.content === true) {
				diagnostics.push({
					severity: 'error',
					code: 'AERO_CONFIG',
					message: `[aero check] content is enabled but no config file at "${path.resolve(root, contentRel)}".`,
					file: path.resolve(root, contentRel),
				})
			} else if (contentLoad.reason === 'error') {
				diagnostics.push(...unknownToAeroDiagnostics(contentLoad.error))
			}
		} else {
			try {
				await initProcessor(contentLoad.config.markdown)
				const { schemaIssues } = await loadAllCollections(contentLoad.config, root)
				if (schemaIssues.length > 0) {
					diagnostics.push(...contentSchemaIssuesToAeroDiagnostics(schemaIssues, 'error'))
				}
			} catch (err) {
				diagnostics.push(...unknownToAeroDiagnostics(err))
			}
		}
	}

	const htmlFiles: string[] = []
	for (const dir of templateDirs(root, dirs.client)) {
		htmlFiles.push(...walkHtmlFiles(dir))
	}
	const sorted = [...new Set(htmlFiles)].sort()
	for (const file of sorted) {
		let source: string
		try {
			source = fs.readFileSync(file, 'utf-8')
		} catch (err) {
			diagnostics.push(...unknownToAeroDiagnostics(err))
			continue
		}
		try {
			compileTemplate(source, {
				root,
				resolvePath,
				importer: file,
			})
		} catch (err) {
			diagnostics.push(...unknownToAeroDiagnostics(err))
		}
	}

	const errors = diagnostics.filter(d => d.severity === 'error')
	if (errors.length === 0) {
		return 0
	}
	const text = formatDiagnosticsTerminal(errors, { plain: true })
	process.stderr.write(text + (text.endsWith('\n') ? '' : '\n'))
	return exitCodeForDiagnostics(errors)
}
