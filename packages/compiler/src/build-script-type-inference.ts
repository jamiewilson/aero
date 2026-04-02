/**
 * TypeScript checker–backed type strings for build-script bindings (spike / foundation for Phase C).
 *
 * @remarks
 * Uses the programmatic TypeScript API. Requires `typescript` at runtime when this module is imported.
 * Narrow scope: types declared in the same file (no module resolution for imports).
 */

import ts from 'typescript'

const OPTIONS: ts.CompilerOptions = {
	target: ts.ScriptTarget.ESNext,
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	skipLibCheck: true,
	noEmit: true,
}

const SYNTHETIC = 'build.ts'

/**
 * Returns a checker-printed type string for a simple value binding in `script`, or null if not found / not typed.
 *
 * @param script - Full `<script is:build>` body (TypeScript).
 * @param bindingName - Identifier to resolve (e.g. `x` from `const x = 1`).
 */
export function getBindingTypeStringFromBuildScript(script: string, bindingName: string): string | null {
	if (!script.trim() || !bindingName) return null

	const sourceFile = ts.createSourceFile(SYNTHETIC, script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

	const host = ts.createCompilerHost(OPTIONS)
	const original = host.getSourceFile.bind(host)
	host.getSourceFile = (fileName, languageVersion, ...args) => {
		if (fileName === SYNTHETIC) return sourceFile
		return original(fileName, languageVersion, ...args)
	}

	const program = ts.createProgram([SYNTHETIC], OPTIONS, host)
	const checker = program.getTypeChecker()

	let hit: ts.Identifier | undefined

	function consider(id: ts.Identifier | undefined) {
		if (id && id.text === bindingName) hit = id
	}

	function visit(node: ts.Node) {
		if (hit) return
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
			consider(node.name)
		} else if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) {
			consider(node.name)
		} else if (ts.isFunctionDeclaration(node) && node.name) {
			consider(node.name)
		}
		ts.forEachChild(node, visit)
	}

	ts.forEachChild(sourceFile, visit)
	if (!hit) return null

	const symbol = checker.getSymbolAtLocation(hit)
	if (!symbol) return null
	const type = checker.getTypeAtLocation(hit)
	return checker.typeToString(type)
}
