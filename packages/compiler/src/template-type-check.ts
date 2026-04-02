/**
 * Template type-checking for `aero check --types`: merged build script and `{ }` interpolations,
 * using project tsconfig (paths, strict) when available — aligned with the Volar language server.
 */

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { FULL_BUILD_SCRIPT_AMBIENT_FOR_TYPECHECK } from './build-script-ambient-prelude'
import { buildTemplateEditorAmbient } from './template-editor-context'
import {
	collectTemplateInterpolationSites,
	formatInterpolationBinderPreludeFromTemplate,
} from './template-interpolation-sites'
import {
	compilerOptionsForVirtualCheck,
	loadProjectTsConfig,
	type LoadedProjectTsConfig,
} from './project-tsconfig'

/** Match {@link packages/language-server/src/virtualCode.ts} BUILD_SCRIPT_FEATURES suppression. */
const SUPPRESSED_TS_CODES = new Set([
	6133, // declared but never read
	6196, // declared but never used
	6198, // All destructured elements are unused
	7006, // implicitly has an 'any' type
])

function shouldReportTsDiagnostic(d: ts.Diagnostic): boolean {
	const c = d.code
	return typeof c !== 'number' || !SUPPRESSED_TS_CODES.has(c)
}

export type TemplateTypeIssueKind = 'build' | 'interpolation'

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

function offsetToOneBasedLineColumn(source: string, offset: number): { line: number; column: number } {
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

function mapDiagnosticToHtmlInterpolation(
	diagnostic: ts.Diagnostic,
	fullSourceFile: ts.SourceFile,
	exprText: string,
	exprStartInVirtual: number,
	htmlSource: string,
	braceOffset: number
): Pick<TemplateTypeIssue, 'line' | 'column' | 'lineEnd' | 'columnEnd'> | null {
	if (diagnostic.start === undefined || diagnostic.file !== fullSourceFile) return null
	const start = diagnostic.start
	if (start < exprStartInVirtual) return null

	const posInExpr = start - exprStartInVirtual
	const bracePos = braceOffset
	const base = offsetToOneBasedLineColumn(htmlSource, bracePos)
	const exprLine1 = offsetToOneBasedLineColumn(exprText, Math.min(Math.max(0, posInExpr), exprText.length))
	const line = base.line + exprLine1.line - 1
	const column = exprLine1.line === 1 ? base.column + 1 + exprLine1.column - 1 : exprLine1.column

	let lineEnd: number | undefined
	let columnEnd: number | undefined
	if (diagnostic.length !== undefined && diagnostic.length > 0) {
		const endInExpr = posInExpr + diagnostic.length
		const endLc = offsetToOneBasedLineColumn(exprText, Math.min(endInExpr, exprText.length))
		lineEnd = base.line + endLc.line - 1
		columnEnd = endLc.line === 1 ? base.column + 1 + endLc.column - 1 : endLc.column
	}

	return { line, column, lineEnd, columnEnd }
}

function createVirtualProgramDiagnostics(
	root: string,
	virtualAbsolutePath: string,
	content: string,
	options: ts.CompilerOptions,
	extraExistingRootFiles: string[]
): ts.Diagnostic[] {
	const roots = [virtualAbsolutePath, ...extraExistingRootFiles.filter(f => fs.existsSync(f))]
	const host = ts.createCompilerHost(options, true)
	const origGetSourceFile = host.getSourceFile!.bind(host)
	host.getSourceFile = (fileName, languageVersion, ...args) => {
		if (path.normalize(fileName) === path.normalize(virtualAbsolutePath)) {
			return ts.createSourceFile(fileName, content, languageVersion, true, ts.ScriptKind.TS)
		}
		return origGetSourceFile(fileName, languageVersion, ...args)
	}
	host.getCurrentDirectory = () => root

	const program = ts.createProgram(roots, options, host)
	const sf = program.getSourceFile(virtualAbsolutePath)
	if (!sf) return []

	return [
		...program.getSyntacticDiagnostics(sf),
		...program.getSemanticDiagnostics(sf),
	].filter(d => d.category === ts.DiagnosticCategory.Error && shouldReportTsDiagnostic(d))
}

export type CheckTemplateTypesOptions = {
	/** Project root (tsconfig discovery, path resolution). */
	readonly root: string
	/** When set, merged before virtual checks (paths, strict, …). */
	readonly project?: LoadedProjectTsConfig | null
	/** Include `{ }` expression checks (same virtual shape as Volar). Default true when `full` implied. */
	readonly interpolations?: boolean
	/** Optional generated registry `.d.ts` (must exist on disk to be included). */
	readonly componentRegistryDtsPath?: string
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

	const virtualBuildPath = path.join(root, '.aero', 'cache', '__aero_typecheck_build.ts')
	const virtualExprDir = path.join(root, '.aero', 'cache')

	const out: TemplateTypeIssue[] = []

	const prelude = FULL_BUILD_SCRIPT_AMBIENT_FOR_TYPECHECK + '\n'
	const { buildScriptBodies } = buildTemplateEditorAmbient(htmlSource)
	const script = buildScriptBodies.join('\n\n')

	if (script.trim()) {
		const full = prelude + script
		const scriptOffset = prelude.length
		const scriptOnly = script
		const diags = createVirtualProgramDiagnostics(root, virtualBuildPath, full, tsOpts, extraRoots)
		const fullSf = ts.createSourceFile(virtualBuildPath, full, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

		for (const d of diags) {
			if (d.start === undefined || d.start < scriptOffset) continue
			const posInScript = d.start - scriptOffset
			const lc = offsetToOneBasedLineColumn(scriptOnly, posInScript)
			const message = ts.flattenDiagnosticMessageText(d.messageText, '\n')
			let lineEnd: number | undefined
			let columnEnd: number | undefined
			if (d.length !== undefined && d.length > 0) {
				const endLc = offsetToOneBasedLineColumn(scriptOnly, posInScript + d.length)
				lineEnd = endLc.line
				columnEnd = endLc.column
			}
			out.push({
				kind: 'build',
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
			const binderDecl = formatInterpolationBinderPreludeFromTemplate(htmlSource, site.braceOffset)
			const open = site.wrapPropsObjectLiteral === true ? '[{' : '['
			const close = site.wrapPropsObjectLiteral === true ? '}]' : ']'
			const head = FULL_BUILD_SCRIPT_AMBIENT_FOR_TYPECHECK + '\n' + binderDecl + open
			const virtualText = head + site.expression + close
			const exprStartInVirtual = head.length
			const virtualPath = path.join(virtualExprDir, `__aero_typecheck_expr_${exprIdx++}.ts`)

			const diags = createVirtualProgramDiagnostics(root, virtualPath, virtualText, tsOpts, extraRoots)
			const sf = ts.createSourceFile(virtualPath, virtualText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

			for (const d of diags) {
				const span = mapDiagnosticToHtmlInterpolation(
					d,
					sf,
					site.expression,
					exprStartInVirtual,
					htmlSource,
					site.braceOffset
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
	return checkTemplateTypes(htmlSource, options).map(issue => ({
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
	}).map(({ kind, ...rest }) => rest as BuildScriptTypeIssue & { readonly file: string })
}
