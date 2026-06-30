import { parseSync } from 'oxc-parser'
import {
	collectReadonlyReactivePropWrites,
	readonlyReactivePropWriteMessage,
} from './readonly-reactive-prop-writes'

export interface PersistBindingAnalysis {
	readonly key?: string
	readonly keyExpr?: string
	readonly defaultExpr: string
	readonly storage?: 'local' | 'session'
	readonly sync?: boolean
	readonly critical?: boolean
	readonly attribute?: string
	readonly attributeExpr?: string
}

export interface StateBinding {
	name: string
	derived: boolean
	dependencies: string[]
	initExpr: string
	reactiveProp?: boolean
	propName?: string
	required?: boolean
	bindable?: boolean
	writes?: boolean
	persist?: PersistBindingAnalysis
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

function isAeroPersistCall(node: unknown): boolean {
	const expr = unwrapExpression(node as any)
	return (
		expr?.type === 'CallExpression' &&
		expr.callee?.type === 'MemberExpression' &&
		expr.callee.object?.type === 'Identifier' &&
		expr.callee.object.name === 'Aero' &&
		expr.callee.property?.type === 'Identifier' &&
		expr.callee.property.name === 'persist' &&
		expr.callee.computed === false
	)
}

function literalStringValue(node: unknown): string | null {
	const expr = unwrapExpression(node as any)
	if (expr?.type !== 'Literal' || typeof expr.value !== 'string') return null
	return expr.value
}

function literalBooleanValue(node: unknown): boolean | null {
	const expr = unwrapExpression(node as any)
	if (expr?.type !== 'Literal' || typeof expr.value !== 'boolean') return null
	return expr.value
}

function persistOptionsFromObject(node: unknown): Omit<PersistBindingAnalysis, 'key' | 'keyExpr' | 'defaultExpr'> {
	const expr = unwrapExpression(node as any)
	if (expr?.type !== 'ObjectExpression') return {}
	const out: Omit<PersistBindingAnalysis, 'key' | 'keyExpr' | 'defaultExpr'> = {}
	for (const property of expr.properties ?? []) {
		if (property?.type !== 'Property' || property.computed) continue
		const name = propertyKeyName(property)
		if (!name) continue
		const value = unwrapExpression(property.value)
		if (name === 'storage' && value?.type === 'Literal' && (value.value === 'local' || value.value === 'session')) {
			out.storage = value.value
		}
		if (name === 'sync') {
			const bool = literalBooleanValue(value)
			if (bool !== null) out.sync = bool
		}
		if (name === 'critical') {
			const bool = literalBooleanValue(value)
			if (bool !== null) out.critical = bool
		}
		if (name === 'attribute') {
			const attr = literalStringValue(value)
			if (attr !== null) {
				out.attribute = attr
			} else if (value?.type === 'Identifier' && typeof value.name === 'string') {
				out.attributeExpr = value.name
			}
		}
	}
	return out
}

function persistBindingFromCall(script: string, call: any): PersistBindingAnalysis | null {
	const keyArg = call?.arguments?.[0]
	const defaultArg = call?.arguments?.[1]
	const optionsArg = call?.arguments?.[2]
	if (!keyArg || !defaultArg) return null
	const keyExprNode = keyArg.expression ?? keyArg
	const defaultExprNode = defaultArg.expression ?? defaultArg
	const key = literalStringValue(keyExprNode)
	const defaultExpr = initExprSource(script, defaultExprNode)
	const options =
		optionsArg === undefined
			? {}
			: persistOptionsFromObject(optionsArg.expression ?? optionsArg)
	return {
		...(key ? { key } : { keyExpr: initExprSource(script, keyExprNode) }),
		defaultExpr,
		...options,
	}
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

function reactivePropBindingFromProperty(
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
			reactiveProp: true,
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
			reactiveProp: true,
			required: false,
			...(bindable ? { bindable: true } : {}),
		}
	}
	return null
}

function reactivePropBindingsFromDeclarator(script: string, declarator: { id: any; init: any }): StateBinding[] {
	if (declarator.id?.type !== 'ObjectPattern') return []
	if (!isAeroPropsExpression(declarator.init)) return []
	const out: StateBinding[] = []
	for (const property of declarator.id.properties ?? []) {
		const binding = reactivePropBindingFromProperty(script, property)
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
	const reactivePropBindings = declarators.flatMap(d => reactivePropBindingsFromDeclarator(script, d))
	const allNames = new Set<string>()
	for (const d of declarators) {
		if (d.id?.type === 'Identifier' && typeof d.id.name === 'string') {
			allNames.add(d.id.name)
		}
	}
	for (const binding of reactivePropBindings) allNames.add(binding.name)

	const bindings: StateBinding[] = [...reactivePropBindings]
	for (const d of declarators) {
		if (d.id?.type !== 'Identifier' || typeof d.id.name !== 'string') continue
		const persistCall = isAeroPersistCall(d.init) ? unwrapExpression(d.init) : null
		const persist = persistCall ? persistBindingFromCall(script, persistCall) : undefined
		const deps = [...collectIdentifiersFromInit(d.init)].filter(dep => allNames.has(dep))
		bindings.push({
			name: d.id.name,
			derived: deps.length > 0,
			dependencies: deps,
			initExpr: initExprSource(script, d.init),
			...(persist ? { persist } : {}),
		})
	}

	const derived = new Set(bindings.filter(b => b.derived).map(b => b.name))
	const diagnostics: StateScriptDiagnostic[] = []
	const reactivePropNames = new Set(reactivePropBindings.map(binding => binding.name))
	const reactivePropNameToPropName = new Map(
		reactivePropBindings.map(binding => [binding.name, binding.propName ?? binding.name])
	)
	const bindableReactivePropNames = new Set(
		reactivePropBindings.filter(binding => binding.bindable).map(binding => binding.name)
	)
	const ownedNames = new Set(bindings.filter(binding => !binding.reactiveProp).map(binding => binding.name))
	const writtenReactiveProps = new Set<string>()
	for (const name of reactivePropNames) {
		if (ownedNames.has(name)) {
			diagnostics.push({
				name,
				message: `Reactive prop \`${name}\` conflicts with an owned state binding.`,
			})
		}
	}

	for (const write of collectReadonlyReactivePropWrites(parsed.program, new Set([...reactivePropNames].filter(name => !bindableReactivePropNames.has(name))))) {
		const propName = reactivePropNameToPropName.get(write.name) ?? write.name
		diagnostics.push({
			name: write.name,
			message: readonlyReactivePropWriteMessage(propName),
			range: write.range,
		})
	}

	walkStateScriptAst(parsed.program, node => {
		if (node?.type === 'AssignmentExpression' && node.left?.type === 'Identifier') {
			const name = node.left.name
			if (reactivePropNames.has(name)) writtenReactiveProps.add(name)
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
			if (reactivePropNames.has(name)) writtenReactiveProps.add(name)
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
		if (binding.reactiveProp && writtenReactiveProps.has(binding.name)) {
			binding.writes = true
		}
		if (binding.persist?.critical && !binding.persist.attribute && !binding.persist.attributeExpr) {
			diagnostics.push({
				name: binding.name,
				message: `Persist binding \`${binding.name}\` uses \`{ critical: true }\` but is missing a static \`attribute\` option (e.g. \`'data-theme'\`).`,
			})
		}
	}

	return {
		bindings,
		diagnostics,
		functionSources: topLevelFunctionDeclarations(parsed.program, script),
	}
}
