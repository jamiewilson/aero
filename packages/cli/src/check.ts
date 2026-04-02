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
import {
	checkTemplateTypesWithFile,
	compileTemplate,
	loadProjectTsConfig,
	writeComponentRegistryDts,
} from '@aero-js/core/compile-check'
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
import { Effect } from 'effect'
import fs from 'node:fs'
import path from 'node:path'

function isDebugEnabled(): boolean {
	const v = process.env.AERO_LOG
	return v === 'debug' || (typeof v === 'string' && v.split(/[\s,]+/).includes('debug'))
}

function startDebugSpan(name: string): { end(details?: string): void } {
	const t0 = Date.now()
	if (isDebugEnabled()) process.stderr.write(`[aero] span:start ${name}\n`)
	return {
		end(details?: string): void {
			if (!isDebugEnabled()) return
			const dt = Date.now() - t0
			process.stderr.write(`[aero] span:end ${name} (${dt}ms${details ? `, ${details}` : ''})\n`)
		},
	}
}

function recordCliDiagnosticsMetrics(diagnostics: readonly AeroDiagnostic[]): void {
	if (!isDebugEnabled() || diagnostics.length === 0) return
	process.stderr.write(
		`[aero] metrics[cli-check] +${diagnostics.length} diagnostics ` +
			`codes=${diagnostics.map(d => d.code).join(',')}\n`
	)
}

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

export type AeroCheckOptions = {
	/**
	 * Run TypeScript checks on merged `<script is:build>` and `{ }` interpolations (same virtual files as Volar),
	 * using the workspace tsconfig (paths, strict). Writes `.aero/cache/types/components.d.ts` for the component registry.
	 */
	types?: boolean
}

/**
 * Run validation checks for an Aero project directory.
 *
 * @returns Exit code `0` when clean; otherwise {@link exitCodeForDiagnostics} (10–14) from the primary error, matching static build buckets.
 */
export async function runAeroCheck(root: string, options: AeroCheckOptions = {}): Promise<number> {
	return Effect.runPromise(
		Effect.gen(function* () {
			const span = startDebugSpan('cli-check')
			const diagnostics: AeroDiagnostic[] = []
			const loadedRaw = yield* Effect.try({
				try: () => loadAeroConfig(root),
				catch: err => err,
			}).pipe(
				Effect.catchAll(err => {
					diagnostics.push(...unknownToAeroDiagnostics(err))
					return Effect.succeed<ReturnType<typeof loadAeroConfig>>(null)
				})
			)
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
					yield* Effect.tryPromise({
						try: async () => {
							await initProcessor(contentLoad.config.markdown)
							const { schemaIssues } = await loadAllCollections(contentLoad.config, root)
							if (schemaIssues.length > 0) {
								diagnostics.push(...contentSchemaIssuesToAeroDiagnostics(schemaIssues, 'error'))
							}
						},
						catch: err => err,
					}).pipe(
						Effect.catchAll(err => {
							diagnostics.push(...unknownToAeroDiagnostics(err))
							return Effect.void
						})
					)
				}
			}

			const htmlFiles: string[] = []
			for (const dir of templateDirs(root, dirs.client)) {
				htmlFiles.push(...walkHtmlFiles(dir))
			}
			const sorted = [...new Set(htmlFiles)].sort()
			const runTypes = options.types === true
			const projectTs = runTypes ? loadProjectTsConfig(root) : null
			const componentsDir = path.join(root, dirs.client, 'components')
			const registryWritten = runTypes ? writeComponentRegistryDts(root, componentsDir) : null
			const registryPath = registryWritten?.path

			yield* Effect.forEach(
				sorted,
				file =>
					Effect.try({
						try: () => fs.readFileSync(file, 'utf-8'),
						catch: err => err,
					}).pipe(
						Effect.catchAll(err => {
							diagnostics.push(...unknownToAeroDiagnostics(err))
							return Effect.succeed<string | null>(null)
						}),
						Effect.flatMap(source => {
							if (source === null) return Effect.void
							return Effect.try({
								try: () => {
									compileTemplate(source, {
										root,
										resolvePath,
										importer: file,
									})
									if (runTypes) {
										for (const issue of checkTemplateTypesWithFile(source, file, {
											root,
											project: projectTs ?? undefined,
											interpolations: true,
											componentRegistryDtsPath: registryPath,
										})) {
											const code =
												issue.kind === 'interpolation' ? 'AERO_COMPILE' : 'AERO_BUILD_SCRIPT'
											diagnostics.push({
												severity: 'error',
												code,
												message: issue.message,
												file: issue.file,
												span: {
													file: issue.file,
													line: issue.line,
													column: issue.column,
													lineEnd: issue.lineEnd,
													columnEnd: issue.columnEnd,
												},
											})
										}
									}
								},
								catch: err => err,
							}).pipe(
								Effect.catchAll(err => {
									diagnostics.push(...unknownToAeroDiagnostics(err))
									return Effect.void
								}),
								Effect.asVoid
							)
						})
					),
				{ discard: true }
			)

			const errors = diagnostics.filter(d => d.severity === 'error')
			if (errors.length === 0) {
				span.end('clean')
				return 0
			}
			recordCliDiagnosticsMetrics(errors)
			const text = formatDiagnosticsTerminal(errors, { plain: true })
			process.stderr.write(text + (text.endsWith('\n') ? '' : '\n'))
			span.end(`errors=${errors.length}`)
			return exitCodeForDiagnostics(errors)
		})
	)
}
