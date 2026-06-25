import { parseSync } from 'oxc-parser'
import {
	collectReadonlyLivePropWrites,
	readonlyLivePropWriteMessage,
} from './readonly-live-prop-writes'

export interface StateBinding {
	name: string
	derived: boolean
	dependencies: string[]
	initExpr: string
	liveProp?: boolean
	propName?: string
	required?: boolean
	bindable?: boolean
	writes?: boolean
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

function walkStateScriptAst(node: unknown, visit: (node: any) => void): void {
	if (!node || typeof node !== 'object') return
	visit(node)
	for (const value of Object.values(node as Record<string, unknown>)) {
		if (!value) continue
		if (Array.isArray(value)) {
			for (const item of value) walkStateScriptAst(item, visit)
			continue
		}
		if (typeof value === 'object') walkStateScriptAst(value, visit)
	}
}

function collectIdentifiersFromInit(initNode: unknown): Set<string> {
	const names = new Set<string>()
	walkStateScriptAst(initNode, node => {
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

function unwrapExpression(node: any): any {
	let current = node
	while (
		current?.type === 'TSAsExpression' ||
		current?.type === 'TSSatisfiesExpression' ||
		current?.type === 'TSNonNullExpression'
	) {
		current = current.expression
	}
	return current
}

function isAeroPropsExpression(node: unknown): boolean {
	const expr = unwrapExpression(node as any)
	return (
		expr?.type === 'MemberExpression' &&
		expr.object?.type === 'Identifier' &&
		expr.object.name === 'Aero' &&
		expr.property?.type === 'Identifier' &&
		expr.property.name === 'props' &&
		expr.computed === false
	)
}

function isAeroBindableCall(node: unknown): boolean {
	const expr = unwrapExpression(node as any)
	return (
		expr?.type === 'CallExpression' &&
		expr.callee?.type === 'MemberExpression' &&
		expr.callee.object?.type === 'Identifier' &&
		expr.callee.object.name === 'Aero' &&
		expr.callee.property?.type === 'Identifier' &&
		expr.callee.property.name === 'bindable' &&
		expr.callee.computed === false
	)
}

function bindableFallbackExprSource(script: string, call: any): string {
	const firstArg = call?.arguments?.[0]
	if (!firstArg) return 'undefined'
	const expr = firstArg.expression ?? firstArg
	return initExprSource(script, expr)
}

function propertyKeyName(property: any): string | null {
	const key = property?.key
	if (key?.type === 'Identifier') return key.name
	if (key?.type === 'Literal' && typeof key.value === 'string') return key.value
	return null
}

function livePropBindingFromProperty(
	script: string,
	property: any
): StateBinding | null {
	if (property?.type !== 'Property') return null
	if (property.computed) return null
	const propName = propertyKeyName(property)
	if (!propName) return null

	const value = property.value
	if (value?.type === 'Identifier') {
		return {
			name: value.name,
			propName,
			derived: false,
			dependencies: [],
			initExpr: 'undefined',
			liveProp: true,
			required: true,
		}
	}
	if (value?.type === 'AssignmentPattern' && value.left?.type === 'Identifier') {
		const bindable = isAeroBindableCall(value.right)
		return {
			name: value.left.name,
			propName,
			derived: false,
			dependencies: [],
			initExpr: bindable
				? bindableFallbackExprSource(script, unwrapExpression(value.right))
				: initExprSource(script, value.right),
			liveProp: true,
			required: false,
			...(bindable ? { bindable: true } : {}),
		}
	}
	return null
}

function livePropBindingsFromDeclarator(script: string, declarator: { id: any; init: any }): StateBinding[] {
	if (declarator.id?.type !== 'ObjectPattern') return []
	if (!isAeroPropsExpression(declarator.init)) return []
	const out: StateBinding[] = []
	for (const property of declarator.id.properties ?? []) {
		const binding = livePropBindingFromProperty(script, property)
		if (binding) out.push(binding)
	}
	return out
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
	const livePropBindings = declarators.flatMap(d => livePropBindingsFromDeclarator(script, d))
	const allNames = new Set<string>()
	for (const d of declarators) {
		if (d.id?.type === 'Identifier' && typeof d.id.name === 'string') {
			allNames.add(d.id.name)
		}
	}
	for (const binding of livePropBindings) allNames.add(binding.name)

	const bindings: StateBinding[] = [...livePropBindings]
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
	const livePropNames = new Set(livePropBindings.map(binding => binding.name))
	const livePropNameToPropName = new Map(
		livePropBindings.map(binding => [binding.name, binding.propName ?? binding.name])
	)
	const bindableLivePropNames = new Set(
		livePropBindings.filter(binding => binding.bindable).map(binding => binding.name)
	)
	const ownedNames = new Set(bindings.filter(binding => !binding.liveProp).map(binding => binding.name))
	const writtenLiveProps = new Set<string>()
	for (const name of livePropNames) {
		if (ownedNames.has(name)) {
			diagnostics.push({
				name,
				message: `Live prop \`${name}\` conflicts with an owned state binding.`,
			})
		}
	}

	for (const write of collectReadonlyLivePropWrites(parsed.program, new Set([...livePropNames].filter(name => !bindableLivePropNames.has(name))))) {
		const propName = livePropNameToPropName.get(write.name) ?? write.name
		diagnostics.push({
			name: write.name,
			message: readonlyLivePropWriteMessage(propName),
			range: write.range,
		})
	}

	walkStateScriptAst(parsed.program, node => {
		if (node?.type === 'AssignmentExpression' && node.left?.type === 'Identifier') {
			const name = node.left.name
			if (livePropNames.has(name)) writtenLiveProps.add(name)
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
			if (livePropNames.has(name)) writtenLiveProps.add(name)
			if (derived.has(name)) {
				diagnostics.push({
					name,
					message: `Derived state \`${name}\` is read-only and cannot be updated.`,
					range: node.range,
				})
			}
		}
	})
	for (const binding of bindings) {
		if (binding.liveProp && writtenLiveProps.has(binding.name)) {
			binding.writes = true
		}
	}

	return {
		bindings,
		diagnostics,
		functionSources: topLevelFunctionDeclarations(parsed.program, script),
	}
}
