/**
 * Template type-checking for `aero check --types`: merged build script and `{ }` interpolations,
 * using project tsconfig (paths, strict) when available — aligned with the Volar language server.
 */

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { BUILD_SCRIPT_PREAMBLE, AMBIENT_DECLARATIONS } from './generated/ambient-preamble'
import {
	collectTemplateInterpolationSites,
	buildTemplateInterpolationVirtualText,
} from './template-interpolation-sites'
import { collectTemplateScriptBlocks, type TemplateScriptBlock } from './template-source'
import { iterateBuildScriptBindings } from './build-scope-bindings'
import {
	compilerOptionsForVirtualCheck,
	loadProjectTsConfig,
	type LoadedProjectTsConfig,
} from './project-tsconfig'

export type TemplateTypeIssueKind =
	| 'build'
	| 'state'
	| 'bundled'
	| 'inline'
	| 'blocking'
	| 'interpolation'

export type TemplateTypeIssue = {
	readonly kind: TemplateTypeIssueKind
	readonly message: string
	readonly line: number
	readonly column: number
	readonly lineEnd?: number
	readonly columnEnd?: number
}

/** @deprecated Use {@link TemplateTypeIssue} */
export type BuildScriptTypeIssue = Omit<TemplateTypeIssue, 'kind'>

function offsetToOneBasedLineColumn(
	source: string,
	offset: number
): { line: number; column: number } {
	let line = 1
	let lineStart = 0
	for (let i = 0; i < offset && i < source.length; i++) {
		if (source[i] === '\n') {
			line++
			lineStart = i + 1
		}
	}
	return { line, column: offset - lineStart + 1 }
}

function expressionAnchorInHtml(htmlSource: string, braceOffset: number): number {
	let i = braceOffset + 1
	while (i < htmlSource.length && /\s/.test(htmlSource[i]!)) i++
	return i
}

function mapDiagnosticToHtmlInterpolation(
	diagnostic: ts.Diagnostic,
	fullSourceFile: ts.SourceFile,
	exprText: string,
	exprStartInVirtual: number,
	htmlSource: string,
	braceOffset: number,
	expressionOffset?: number
): Pick<TemplateTypeIssue, 'line' | 'column' | 'lineEnd' | 'columnEnd'> | null {
	if (diagnostic.start === undefined || diagnostic.file !== fullSourceFile) return null
	const start = diagnostic.start
	if (start < exprStartInVirtual) return null

	const posInExpr = start - exprStartInVirtual
	const anchorOffset =
		expressionOffset ?? expressionAnchorInHtml(htmlSource, braceOffset)
	const base = offsetToOneBasedLineColumn(htmlSource, anchorOffset)
	const exprLine1 = offsetToOneBasedLineColumn(
		exprText,
		Math.min(Math.max(0, posInExpr), exprText.length)
	)
	const line = base.line + exprLine1.line - 1
	const column = exprLine1.line === 1 ? base.column + exprLine1.column : exprLine1.column

	let lineEnd: number | undefined
	let columnEnd: number | undefined
	if (diagnostic.length !== undefined && diagnostic.length > 0) {
		const endInExpr = posInExpr + diagnostic.length
		const endLc = offsetToOneBasedLineColumn(exprText, Math.min(endInExpr, exprText.length))
		lineEnd = base.line + endLc.line - 1
		columnEnd = endLc.line === 1 ? base.column + endLc.column : endLc.column
	}

	return { line, column, lineEnd, columnEnd }
}

const VIRTUAL_AMBIENT_DECLARATIONS = AMBIENT_DECLARATIONS + '\n'

function createVirtualProgramDiagnostics(
	root: string,
	virtualAbsolutePath: string,
	content: string,
	options: ts.CompilerOptions,
	extraExistingRootFiles: string[],
	scriptKind = ts.ScriptKind.TS
): ts.Diagnostic[] {
	const virtualAmbientPath = path.join(root, '.aero', 'cache', '__aero_typecheck_ambient.d.ts')
	const roots = [
		virtualAbsolutePath,
		virtualAmbientPath,
		...extraExistingRootFiles.filter(f => fs.existsSync(f)),
	]
	const host = ts.createCompilerHost(options, true)
	const origGetSourceFile = host.getSourceFile!.bind(host)
	host.getSourceFile = (fileName, languageVersion, ...args) => {
		const normalized = path.normalize(fileName)
		if (normalized === path.normalize(virtualAbsolutePath)) {
			return ts.createSourceFile(fileName, content, languageVersion, true, scriptKind)
		}
		if (normalized === path.normalize(virtualAmbientPath)) {
			return ts.createSourceFile(
				fileName,
				VIRTUAL_AMBIENT_DECLARATIONS,
				languageVersion,
				true,
				ts.ScriptKind.TS
			)
		}
		return origGetSourceFile(fileName, languageVersion, ...args)
	}
	host.getCurrentDirectory = () => root

	const program = ts.createProgram(roots, options, host)
	const sf = program.getSourceFile(virtualAbsolutePath)
	if (!sf) return []

	return [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)].filter(
		d => d.category === ts.DiagnosticCategory.Error
	)
}

export type CheckTemplateTypesOptions = {
	/** Project root (tsconfig discovery, path resolution). */
	readonly root: string
	/** Original HTML file path, used to resolve relative virtual imports. */
	readonly templateFilePath?: string
	/** When set, merged before virtual checks (paths, strict, …). */
	readonly project?: LoadedProjectTsConfig | null
	/** Include `{ }` expression checks (same virtual shape as Volar). Default true when `full` implied. */
	readonly interpolations?: boolean
	/** Optional generated registry `.d.ts` (must exist on disk to be included). */
	readonly componentRegistryDtsPath?: string
	/** Optional generated snippet module `.d.ts` (must exist on disk to be included). */
	readonly snippetsDtsPath?: string
}

function scriptUsesTypeScript(block: TemplateScriptBlock): boolean {
	if (block.kind === 'build' || block.kind === 'state') {
		return !/\blang\s*=\s*["'](?:js|javascript)["']/i.test(block.attrs)
	}
	return /\blang\s*=\s*["'](?:ts|typescript)["']/i.test(block.attrs)
}

function buildTemplateUseFooter(source: string, script: string): string {
	const expressions = collectTemplateInterpolationSites(source).map(site => site.expression)
	return [...iterateBuildScriptBindings(script)]
		.filter(binding => {
			const escaped = binding.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
			return expressions.some(expression => new RegExp(`\\b${escaped}\\b`).test(expression))
		})
		.map(binding => `\nvoid ${binding.name}`)
		.join('')
}

/**
 * Full template type-check: build script + optional interpolations, with project-aware resolution.
 */
export function checkTemplateTypes(
	htmlSource: string,
	options: CheckTemplateTypesOptions
): TemplateTypeIssue[] {
	const root = options.root
	const loaded = options.project ?? loadProjectTsConfig(root)
	const baseOpts = loaded?.options
	const tsOpts = compilerOptionsForVirtualCheck(baseOpts)
	const extraRoots: string[] = []
	if (options.componentRegistryDtsPath && fs.existsSync(options.componentRegistryDtsPath)) {
		extraRoots.push(path.resolve(options.componentRegistryDtsPath))
	}
	if (options.snippetsDtsPath && fs.existsSync(options.snippetsDtsPath)) {
		extraRoots.push(path.resolve(options.snippetsDtsPath))
	}

	const virtualBase = options.templateFilePath ?? path.join(root, '.aero', 'cache', '__aero_typecheck')
	const virtualExprDir = path.dirname(virtualBase)

	const out: TemplateTypeIssue[] = []

	let scriptIdx = 0
	for (const block of collectTemplateScriptBlocks(htmlSource)) {
		if (block.kind === 'external' || !block.content.trim()) continue
		const usesTypeScript = scriptUsesTypeScript(block)
		const prelude = block.kind === 'build' || block.kind === 'state' ? BUILD_SCRIPT_PREAMBLE + '\n' : ''
		const virtualPath = `${virtualBase}.${block.kind}_${scriptIdx++}.${usesTypeScript ? 'ts' : 'js'}`
		const content =
			prelude + block.content + (block.kind === 'build' ? buildTemplateUseFooter(htmlSource, block.content) : '')
		const diags = createVirtualProgramDiagnostics(
			root,
			virtualPath,
			content,
			tsOpts,
			extraRoots,
			usesTypeScript ? ts.ScriptKind.TS : ts.ScriptKind.JS
		)

		for (const d of diags) {
			if (d.start === undefined || d.start < prelude.length) continue
			const posInScript = d.start - prelude.length
			const lc = offsetToOneBasedLineColumn(htmlSource, block.contentStart + posInScript)
			const message = ts.flattenDiagnosticMessageText(d.messageText, '\n')
			let lineEnd: number | undefined
			let columnEnd: number | undefined
			if (d.length !== undefined && d.length > 0) {
				const endLc = offsetToOneBasedLineColumn(htmlSource, block.contentStart + posInScript + d.length)
				lineEnd = endLc.line
				columnEnd = endLc.column
			}
			out.push({
				kind: block.kind,
				message,
				line: lc.line,
				column: lc.column,
				lineEnd,
				columnEnd,
			})
		}
	}

	const wantInterp = options.interpolations !== false
	if (wantInterp) {
		const sites = collectTemplateInterpolationSites(htmlSource)
		let exprIdx = 0
		for (const site of sites) {
			const { virtualText, expressionOffsetInVirtual: exprStartInVirtual } =
				buildTemplateInterpolationVirtualText(
					htmlSource,
					site,
					BUILD_SCRIPT_PREAMBLE + '\n'
				)
			const virtualPath = path.join(virtualExprDir, `${path.basename(virtualBase)}.expr_${exprIdx++}.ts`)

			const diags = createVirtualProgramDiagnostics(
				root,
				virtualPath,
				virtualText,
				tsOpts,
				extraRoots
			)
			const sf = ts.createSourceFile(
				virtualPath,
				virtualText,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TS
			)

			for (const d of diags) {
				const span = mapDiagnosticToHtmlInterpolation(
					d,
					sf,
					site.expression,
					exprStartInVirtual,
					htmlSource,
					site.braceOffset,
					site.expressionOffset
				)
				if (!span) continue
				out.push({
					kind: 'interpolation',
					message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
					...span,
				})
			}
		}
	}

	return out
}

/**
 * @deprecated Use {@link checkTemplateTypes} with `{ root }`.
 */
export function checkTemplateBuildScriptTypes(htmlSource: string): BuildScriptTypeIssue[] {
	const loaded = loadProjectTsConfig(process.cwd())
	return checkTemplateTypes(htmlSource, {
		root: process.cwd(),
		project: loaded ?? undefined,
		interpolations: false,
	}).map(({ kind: _k, ...rest }) => rest)
}

export function checkTemplateTypesWithFile(
	htmlSource: string,
	filePath: string,
	options: CheckTemplateTypesOptions
): (TemplateTypeIssue & { readonly file: string })[] {
	return checkTemplateTypes(htmlSource, { ...options, templateFilePath: filePath }).map(issue => ({
		...issue,
		file: filePath,
	}))
}

/**
 * @deprecated Use {@link checkTemplateTypesWithFile}
 */
export function checkTemplateBuildScriptTypesWithFile(
	htmlSource: string,
	filePath: string
): (BuildScriptTypeIssue & { readonly file: string })[] {
	const loaded = loadProjectTsConfig(process.cwd())
	return checkTemplateTypesWithFile(htmlSource, filePath, {
		root: process.cwd(),
		project: loaded ?? undefined,
		interpolations: false,
	}).map(({ kind: _kind, ...rest }) => rest as BuildScriptTypeIssue & { readonly file: string })
}
