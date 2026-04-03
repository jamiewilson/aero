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

function createProgramForScript(script: string): {
	program: ts.Program
	sourceFile: ts.SourceFile
} {
	const sourceFile = ts.createSourceFile(
		SYNTHETIC,
		script,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	)
	const host = ts.createCompilerHost(OPTIONS)
	const original = host.getSourceFile.bind(host)
	host.getSourceFile = (fileName, languageVersion, ...args) => {
		if (fileName === SYNTHETIC) return sourceFile
		return original(fileName, languageVersion, ...args)
	}
	const program = ts.createProgram([SYNTHETIC], OPTIONS, host)
	return { program, sourceFile }
}

/**
 * All simple bindings in `script` mapped to checker-printed types (first occurrence wins).
 * Includes imports, `const`/`let`/`var` (incl. destructuring), and `function` declarations.
 */
export function collectBindingTypeStringsFromBuildScript(script: string): Map<string, string> {
	const out = new Map<string, string>()
	if (!script.trim()) return out

	const { program, sourceFile } = createProgramForScript(script)
	const checker = program.getTypeChecker()

	function record(id: ts.Identifier) {
		const name = id.text
		if (!name || out.has(name)) return
		const symbol = checker.getSymbolAtLocation(id)
		if (!symbol) return
		const type = checker.getTypeAtLocation(id)
		out.set(name, checker.typeToString(type))
	}

	function recordPattern(name: ts.BindingName) {
		if (ts.isIdentifier(name)) {
			record(name)
			return
		}
		if (ts.isObjectBindingPattern(name)) {
			for (const el of name.elements) {
				if (ts.isOmittedExpression(el)) continue
				if (ts.isIdentifier(el.name)) record(el.name)
				else recordPattern(el.name)
			}
			return
		}
		if (ts.isArrayBindingPattern(name)) {
			for (const el of name.elements) {
				if (ts.isOmittedExpression(el)) continue
				if (ts.isIdentifier(el.name)) record(el.name)
				else recordPattern(el.name)
			}
		}
	}

	for (const stmt of sourceFile.statements) {
		if (ts.isImportDeclaration(stmt) && stmt.importClause) {
			const cl = stmt.importClause
			if (cl.name) record(cl.name)
			if (cl.namedBindings) {
				if (ts.isNamespaceImport(cl.namedBindings)) record(cl.namedBindings.name)
				else if (ts.isNamedImports(cl.namedBindings)) {
					for (const el of cl.namedBindings.elements) record(el.name)
				}
			}
		}
	}

	function visit(node: ts.Node) {
		if (ts.isVariableDeclaration(node)) {
			recordPattern(node.name)
		} else if (ts.isFunctionDeclaration(node) && node.name) {
			record(node.name)
		}
		ts.forEachChild(node, visit)
	}

	ts.forEachChild(sourceFile, visit)
	return out
}

/**
 * Merge type maps from several build scripts; earlier bodies win for each name.
 */
export function collectBindingTypeStringsFromBuildScripts(
	bodies: Iterable<string>
): Map<string, string> {
	const merged = new Map<string, string>()
	for (const body of bodies) {
		const m = collectBindingTypeStringsFromBuildScript(body)
		for (const [k, v] of m) {
			if (!merged.has(k)) merged.set(k, v)
		}
	}
	return merged
}

/**
 * Returns a checker-printed type string for a simple value binding in `script`, or null if not found / not typed.
 *
 * @param script - Full `<script is:build>` body (TypeScript).
 * @param bindingName - Identifier to resolve (e.g. `x` from `const x = 1`).
 */
export function getBindingTypeStringFromBuildScript(
	script: string,
	bindingName: string
): string | null {
	if (!bindingName) return null
	return collectBindingTypeStringsFromBuildScript(script).get(bindingName) ?? null
}
