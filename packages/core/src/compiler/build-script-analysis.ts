/**
 * AST-based analysis of Aero build scripts: extract imports and getStaticPaths export.
 *
 * @remarks
 * Uses oxc-parser (TypeScript-capable) so the same pipeline supports JS and TS in
 * `<script is:build>`. Returns structured data for codegen to rewrite imports and
 * emit getStaticPaths as a named export.
 */

import { parseSync, ImportNameKind } from 'oxc-parser'

/** Single import entry for codegen: specifier and bindings. */
export interface BuildScriptImport {
	specifier: string
	defaultBinding: string | null
	namedBindings: Array<{ imported: string; local: string }>
	namespaceBinding: string | null
}

/** Result of analyzing a build script: imports, optional getStaticPaths text, and script with both removed. */
export interface BuildScriptAnalysisResult {
	imports: BuildScriptImport[]
	getStaticPathsFn: string | null
	scriptWithoutImportsAndGetStaticPaths: string
}

const BUILD_SCRIPT_FILENAME = 'build.ts'

/**
 * Analyze build script source: parse with oxc, extract static imports and
 * `export [async] function getStaticPaths(...)`, return bindings and script with those removed.
 *
 * @param script - Raw build script content (JS or TS).
 * @returns Structured result for codegen. On parse error, throws.
 */
export function analyzeBuildScript(script: string): BuildScriptAnalysisResult {
	if (!script.trim()) {
		return {
			imports: [],
			getStaticPathsFn: null,
			scriptWithoutImportsAndGetStaticPaths: script,
		}
	}

	const result = parseSync(BUILD_SCRIPT_FILENAME, script, {
		sourceType: 'module',
		range: true,
		lang: 'ts',
	})

	const errors = result.errors
	if (errors.length > 0) {
		const first = errors[0]
		throw new Error(
			`[aero] Build script parse error: ${first.message}${first.codeframe ? '\n' + first.codeframe : ''}`,
		)
	}

	const mod = result.module
	const program = result.program

	// 1. Build imports from ESM module info (skip type-only imports for runtime rewrite)
	const imports: BuildScriptImport[] = []
	for (const imp of mod.staticImports) {
		const specifier = imp.moduleRequest.value
		let defaultBinding: string | null = null
		const namedBindings: Array<{ imported: string; local: string }> = []
		let namespaceBinding: string | null = null

		for (const entry of imp.entries) {
			if (entry.isType) continue
			const local = entry.localName.value
			switch (entry.importName.kind) {
				case ImportNameKind.Default:
					defaultBinding = local
					break
				case ImportNameKind.NamespaceObject:
					namespaceBinding = local
					break
				case ImportNameKind.Name: {
					const imported = entry.importName.name ?? local
					namedBindings.push({ imported, local })
					break
				}
				default:
					break
			}
		}

		imports.push({
			specifier,
			defaultBinding,
			namedBindings,
			namespaceBinding,
		})
	}

	// 2. Find export function getStaticPaths in program body (ESTree/TS-ESTree shape)
	let getStaticPathsRange: [number, number] | null = null
	const body = (program as { body?: Array<{ type: string; declaration?: { type: string; id?: { name: string }; async?: boolean }; range?: [number, number] }> }).body
	if (body) {
		for (const stmt of body) {
			if (stmt.type !== 'ExportNamedDeclaration') continue
			const decl = stmt.declaration
			if (!decl || decl.type !== 'FunctionDeclaration') continue
			const name = decl.id?.name
			if (name !== 'getStaticPaths') continue
			const range = stmt.range
			if (range) {
				getStaticPathsRange = range
				break
			}
		}
	}

	const getStaticPathsFn =
		getStaticPathsRange !== null
			? script.slice(getStaticPathsRange[0], getStaticPathsRange[1])
			: null

	// 3. Build script without imports and getStaticPaths: merge and sort ranges, then keep segments between them
	const rangesToRemove: Array<[number, number]> = []
	if (getStaticPathsRange) {
		rangesToRemove.push(getStaticPathsRange)
	}
	for (const imp of mod.staticImports) {
		rangesToRemove.push([imp.start, imp.end])
	}
	rangesToRemove.sort((a, b) => a[0] - b[0])

	const parts: string[] = []
	let lastEnd = 0
	for (const [start, end] of rangesToRemove) {
		if (start > lastEnd) {
			parts.push(script.slice(lastEnd, start))
		}
		lastEnd = end
	}
	if (lastEnd < script.length) {
		parts.push(script.slice(lastEnd))
	}
	const scriptWithoutImportsAndGetStaticPaths = parts.join('').trim()

	return {
		imports,
		getStaticPathsFn,
		scriptWithoutImportsAndGetStaticPaths,
	}
}

/** Editor-oriented import entry: same bindings as BuildScriptImport plus source range and per-binding ranges. */
export interface BuildScriptImportForEditor extends BuildScriptImport {
	/** Character range of the full import statement [start, end]. */
	range: [number, number]
	/** Character range of the specifier string (path) within the script. */
	specifierRange: [number, number]
	/** Per-binding character ranges: local name -> [start, end]. */
	bindingRanges?: Record<string, [number, number]>
}

/** Result of analyzeBuildScriptForEditor: imports with source ranges for editor use (e.g. definition provider). */
export interface BuildScriptAnalysisForEditorResult {
	imports: BuildScriptImportForEditor[]
}

/**
 * Analyze build script for editor use: same as analyzeBuildScript but returns imports with
 * source ranges (full statement and per-binding) so the extension can map to vscode.Range.
 *
 * @param script - Raw build script content (JS or TS).
 * @returns Imports with range and bindingRanges. On parse error, throws.
 */
export function analyzeBuildScriptForEditor(script: string): BuildScriptAnalysisForEditorResult {
	if (!script.trim()) {
		return { imports: [] }
	}

	const result = parseSync(BUILD_SCRIPT_FILENAME, script, {
		sourceType: 'module',
		range: true,
		lang: 'ts',
	})

	const errors = result.errors
	if (errors.length > 0) {
		const first = errors[0]
		throw new Error(
			`[aero] Build script parse error: ${first.message}${first.codeframe ? '\n' + first.codeframe : ''}`,
		)
	}

	const mod = result.module
	const imports: BuildScriptImportForEditor[] = []

	for (const imp of mod.staticImports) {
		const specifier = imp.moduleRequest.value
		let defaultBinding: string | null = null
		const namedBindings: Array<{ imported: string; local: string }> = []
		let namespaceBinding: string | null = null
		const bindingRanges: Record<string, [number, number]> = {}

		for (const entry of imp.entries) {
			if (entry.isType) continue
			const local = entry.localName.value
			// Per-binding range from oxc ValueSpan
			bindingRanges[local] = [entry.localName.start, entry.localName.end]
			switch (entry.importName.kind) {
				case ImportNameKind.Default:
					defaultBinding = local
					break
				case ImportNameKind.NamespaceObject:
					namespaceBinding = local
					break
				case ImportNameKind.Name: {
					const imported = entry.importName.name ?? local
					namedBindings.push({ imported, local })
					break
				}
				default:
					break
			}
		}

		imports.push({
			specifier,
			defaultBinding,
			namedBindings,
			namespaceBinding,
			range: [imp.start, imp.end],
			specifierRange: [imp.moduleRequest.start, imp.moduleRequest.end],
			bindingRanges,
		})
	}

	return { imports }
}
