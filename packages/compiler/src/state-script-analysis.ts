import { parseSync } from 'oxc-parser'

export interface StateBinding {
	name: string
	derived: boolean
	dependencies: string[]
	initExpr: string
}

export interface StateScriptDiagnostic {
	message: string
	name: string
	range?: [number, number]
}

export interface StateScriptAnalysisResult {
	bindings: StateBinding[]
	diagnostics: StateScriptDiagnostic[]
	functionSources: string[]
}

const STATE_SCRIPT_FILENAME = 'state.ts'
const STATE_SCRIPT_PARSE_OPTIONS = {
	sourceType: 'module',
	range: true,
	lang: 'ts',
} as const

function walk(node: unknown, visit: (node: any) => void): void {
	if (!node || typeof node !== 'object') return
	visit(node)
	for (const value of Object.values(node as Record<string, unknown>)) {
		if (!value) continue
		if (Array.isArray(value)) {
			for (const item of value) walk(item, visit)
			continue
		}
		if (typeof value === 'object') walk(value, visit)
	}
}

function collectIdentifiersFromInit(initNode: unknown): Set<string> {
	const names = new Set<string>()
	walk(initNode, node => {
		if (node?.type === 'Identifier' && typeof node.name === 'string') {
			names.add(node.name)
		}
	})
	return names
}

function topLevelVariableDeclarators(program: any): Array<{ id: any; init: any; range?: [number, number] }> {
	const out: Array<{ id: any; init: any; range?: [number, number] }> = []
	for (const stmt of program?.body ?? []) {
		let declaration = stmt
		if (stmt?.type === 'ExportNamedDeclaration' && stmt.declaration) declaration = stmt.declaration
		if (declaration?.type !== 'VariableDeclaration') continue
		for (const d of declaration.declarations ?? []) {
			out.push({ id: d.id, init: d.init, range: d.range })
		}
	}
	return out
}

function topLevelFunctionDeclarations(program: any, script: string): string[] {
	const out: string[] = []
	for (const stmt of program?.body ?? []) {
		let declaration = stmt
		if (stmt?.type === 'ExportNamedDeclaration' && stmt.declaration) declaration = stmt.declaration
		if (declaration?.type !== 'FunctionDeclaration') continue
		if (typeof declaration.start !== 'number' || typeof declaration.end !== 'number') continue
		out.push(script.slice(declaration.start, declaration.end))
	}
	return out
}

function initExprSource(script: string, init: unknown): string {
	if (!init || typeof init !== 'object') return 'undefined'
	const node = init as { start?: number; end?: number }
	if (typeof node.start !== 'number' || typeof node.end !== 'number') return 'undefined'
	return script.slice(node.start, node.end)
}

export function analyzeStateScript(script: string): StateScriptAnalysisResult {
	if (!script.trim()) return { bindings: [], diagnostics: [], functionSources: [] }

	const parsed = parseSync(STATE_SCRIPT_FILENAME, script, STATE_SCRIPT_PARSE_OPTIONS)
	if (parsed.errors.length > 0) {
		const first = parsed.errors[0]
		throw new Error(
			`[aero] State script parse error: ${first.message}${first.codeframe ? '\n' + first.codeframe : ''}`
		)
	}

	const declarators = topLevelVariableDeclarators(parsed.program)
	const allNames = new Set<string>()
	for (const d of declarators) {
		if (d.id?.type === 'Identifier' && typeof d.id.name === 'string') {
			allNames.add(d.id.name)
		}
	}

	const bindings: StateBinding[] = []
	for (const d of declarators) {
		if (d.id?.type !== 'Identifier' || typeof d.id.name !== 'string') continue
		const deps = [...collectIdentifiersFromInit(d.init)].filter(dep => allNames.has(dep))
		bindings.push({
			name: d.id.name,
			derived: deps.length > 0,
			dependencies: deps,
			initExpr: initExprSource(script, d.init),
		})
	}

	const derived = new Set(bindings.filter(b => b.derived).map(b => b.name))
	const diagnostics: StateScriptDiagnostic[] = []

	walk(parsed.program, node => {
		if (node?.type === 'AssignmentExpression' && node.left?.type === 'Identifier') {
			const name = node.left.name
			if (derived.has(name)) {
				diagnostics.push({
					name,
					message: `Derived state \`${name}\` is read-only and cannot be assigned.`,
					range: node.range,
				})
			}
		}
		if (node?.type === 'UpdateExpression' && node.argument?.type === 'Identifier') {
			const name = node.argument.name
			if (derived.has(name)) {
				diagnostics.push({
					name,
					message: `Derived state \`${name}\` is read-only and cannot be updated.`,
					range: node.range,
				})
			}
		}
	})

	return {
		bindings,
		diagnostics,
		functionSources: topLevelFunctionDeclarations(parsed.program, script),
	}
}
