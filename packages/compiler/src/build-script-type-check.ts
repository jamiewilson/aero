/**
 * TypeScript semantic/syntactic check for merged `<script is:build>` bodies (Phase C — `aero check --types`).
 *
 * @remarks
 * Uses the same ambient prelude as the language server build-script virtual file.
 */

import ts from 'typescript'
import { BUILD_SCRIPT_AMBIENT_PRELUDE } from './build-script-ambient-prelude'
import { buildTemplateEditorAmbient } from './template-editor-context'

const SYNTHETIC = 'aero-build-script.ts'

const OPTIONS: ts.CompilerOptions = {
	target: ts.ScriptTarget.ESNext,
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	skipLibCheck: true,
	noEmit: true,
	strict: true,
}

export type BuildScriptTypeIssue = {
	readonly message: string
	readonly line: number
	readonly column: number
	readonly lineEnd?: number
	readonly columnEnd?: number
}

/**
 * Returns syntax/semantic issues for the merged build script, or empty when there is no build script.
 * Issues are mapped to the original HTML file using 1-based line/column in the script body
 * (not the prelude).
 */
export function checkTemplateBuildScriptTypes(htmlSource: string): BuildScriptTypeIssue[] {
	const { buildScriptBodies } = buildTemplateEditorAmbient(htmlSource)
	const script = buildScriptBodies.join('\n\n')
	if (!script.trim()) return []

	const prelude = BUILD_SCRIPT_AMBIENT_PRELUDE + '\n'
	const full = prelude + script
	const scriptOffset = prelude.length

	const scriptOnlySf = ts.createSourceFile(
		'aero-build-user.ts',
		script,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	)

	const host = ts.createCompilerHost(OPTIONS)
	const originalGetSourceFile = host.getSourceFile.bind(host)
	host.getSourceFile = (fileName, languageVersion, ...rest) => {
		if (fileName === SYNTHETIC) {
			return ts.createSourceFile(SYNTHETIC, full, languageVersion, true, ts.ScriptKind.TS)
		}
		return originalGetSourceFile(fileName, languageVersion, ...rest)
	}

	const program = ts.createProgram([SYNTHETIC], OPTIONS, host)
	const sourceFile = program.getSourceFile(SYNTHETIC)
	if (!sourceFile) return []

	const all = [
		...program.getSyntacticDiagnostics(sourceFile),
		...program.getSemanticDiagnostics(sourceFile),
	].filter(d => d.category === ts.DiagnosticCategory.Error)

	const out: BuildScriptTypeIssue[] = []
	for (const d of all) {
		if (d.file !== sourceFile || d.start === undefined) continue
		const start = d.start
		if (start < scriptOffset) continue

		const posInScript = start - scriptOffset
		const startLc = scriptOnlySf.getLineAndCharacterOfPosition(posInScript)
		const line = startLc.line + 1
		const column = startLc.character + 1

		let lineEnd: number | undefined
		let columnEnd: number | undefined
		if (d.length !== undefined && d.length > 0) {
			const endLc = scriptOnlySf.getLineAndCharacterOfPosition(posInScript + d.length)
			lineEnd = endLc.line + 1
			columnEnd = endLc.character + 1
		}

		const message = ts.flattenDiagnosticMessageText(d.messageText, '\n')
		out.push({ message, line, column, lineEnd, columnEnd })
	}

	return out
}

/**
 * Same as {@link checkTemplateBuildScriptTypes} but attaches `file` for CLI/diagnostics.
 */
export function checkTemplateBuildScriptTypesWithFile(
	htmlSource: string,
	filePath: string
): (BuildScriptTypeIssue & { readonly file: string })[] {
	return checkTemplateBuildScriptTypes(htmlSource).map(issue => ({
		...issue,
		file: filePath,
	}))
}
