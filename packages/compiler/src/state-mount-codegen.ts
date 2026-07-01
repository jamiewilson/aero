import type {
	IRNode,
	IRReactiveBusyBind,
	IRReactiveClassBind,
	IRReactiveAttributeBind,
	IRReactiveComponentBind,
	IRReactiveEventBind,
	IRReactiveForBind,
	IRReactiveHtmlBind,
	IRReactiveIfBind,
	IRReactiveSwitchBind,
	IRReactiveModelBind,
	IRReactivePropertyBind,
	IRReactiveShowBind,
	IRReactiveTextBind,
} from './ir'
import type { BuildScriptImport } from './build-script-analysis'
import type { StateScriptAnalysisResult } from './state-script-analysis'
import { emitToJS } from './emit'
import { getRenderContextDestructurePattern } from './helpers'
import {
	HYPERMEDIA_ACTION_NAMES,
	rewriteExprForScope,
	rewriteStmtForScope,
} from './scope-expr-codegen'
import { lowerStateScript, type LoweredStateScript } from './lower-state-script'
import { rewriteHypermediaActionStateRefs } from './hypermedia-action-state-refs'

const STRUCTURAL_BRANCH_CONTEXT_DESTRUCTURE = `const { ${getRenderContextDestructurePattern()
	.split(', ')
	.filter(name => name !== 'slots = {}' && name !== 'renderComponent')
	.join(', ')} } = Aero;`

function isSimpleForBinding(binding: string): boolean {
	return /^[A-Za-z_$][\w$]*$/.test(binding.trim())
}

function needsForDestructureCodegen(binding: string, bindingNames: readonly string[]): boolean {
	return bindingNames.length > 0 && !isSimpleForBinding(binding)
}

function stripStructuralBranchOutVars(nodes: IRNode[]): IRNode[] {
	return nodes.map(node => stripStructuralBranchOutVar(node))
}

/** Branch render fns use local `__out`; drop slot/component outVar overrides from lowered IR. */
function stripStructuralBranchOutVar(node: IRNode): IRNode {
	switch (node.kind) {
		case 'Append':
		case 'Slot':
		case 'Component':
			return { ...node, outVar: undefined }
		case 'For':
			return { ...node, body: stripStructuralBranchOutVars(node.body) }
		case 'If': {
			return {
				...node,
				body: stripStructuralBranchOutVars(node.body),
				elseIf: node.elseIf?.map(branch => ({
					...branch,
					body: stripStructuralBranchOutVars(branch.body),
				})),
				else: node.else ? stripStructuralBranchOutVars(node.else) : undefined,
			}
		}
		case 'Switch':
			return {
				...node,
				cases: node.cases.map(branch => ({
					...branch,
					body: stripStructuralBranchOutVars(branch.body),
				})),
				defaultBody: node.defaultBody
					? stripStructuralBranchOutVars(node.defaultBody)
					: undefined,
			}
		default:
			return node
	}
}

export interface BranchReactiveBinds {
	textBinds: IRReactiveTextBind[]
	eventBinds: IRReactiveEventBind[]
	busyBinds: IRReactiveBusyBind[]
	showBinds: IRReactiveShowBind[]
	htmlBinds: IRReactiveHtmlBind[]
	classBinds: IRReactiveClassBind[]
	attributeBinds: IRReactiveAttributeBind[]
	propertyBinds: IRReactivePropertyBind[]
	modelBinds: IRReactiveModelBind[]
	componentBinds: IRReactiveComponentBind[]
}

export interface CollectedReactiveBinds {
	textBinds: IRReactiveTextBind[]
	eventBinds: IRReactiveEventBind[]
	busyBinds: IRReactiveBusyBind[]
	componentBinds: IRReactiveComponentBind[]
	showBinds: IRReactiveShowBind[]
	htmlBinds: IRReactiveHtmlBind[]
	classBinds: IRReactiveClassBind[]
	attributeBinds: IRReactiveAttributeBind[]
	propertyBinds: IRReactivePropertyBind[]
	modelBinds: IRReactiveModelBind[]
	ifBinds: IRReactiveIfBind[]
	forBinds: IRReactiveForBind[]
	switchBinds: IRReactiveSwitchBind[]
}

function collectBranchBinds(body: IRNode[]): BranchReactiveBinds {
	const branch: BranchReactiveBinds = {
		textBinds: [],
		eventBinds: [],
		busyBinds: [],
		showBinds: [],
		htmlBinds: [],
		classBinds: [],
		attributeBinds: [],
		propertyBinds: [],
		modelBinds: [],
		componentBinds: [],
	}
	const collected = collectReactiveBinds(body)
	branch.textBinds = collected.textBinds
	branch.eventBinds = collected.eventBinds
	branch.busyBinds = collected.busyBinds
	branch.showBinds = collected.showBinds
	branch.htmlBinds = collected.htmlBinds
	branch.classBinds = collected.classBinds
	branch.attributeBinds = collected.attributeBinds
	branch.propertyBinds = collected.propertyBinds
	branch.modelBinds = collected.modelBinds
	branch.componentBinds = collected.componentBinds
	return branch
}

export function collectReactiveBinds(bodyIR: IRNode[]): CollectedReactiveBinds {
	const textBinds: IRReactiveTextBind[] = []
	const eventBinds: IRReactiveEventBind[] = []
	const busyBinds: IRReactiveBusyBind[] = []
	const componentBinds: IRReactiveComponentBind[] = []
	const showBinds: IRReactiveShowBind[] = []
	const htmlBinds: IRReactiveHtmlBind[] = []
	const classBinds: IRReactiveClassBind[] = []
	const attributeBinds: IRReactiveAttributeBind[] = []
	const propertyBinds: IRReactivePropertyBind[] = []
	const modelBinds: IRReactiveModelBind[] = []
	const ifBinds: IRReactiveIfBind[] = []
	const forBinds: IRReactiveForBind[] = []
	const switchBinds: IRReactiveSwitchBind[] = []

	function walk(nodes: IRNode[]): void {
		for (const node of nodes) {
			if (node.kind === 'ReactiveTextBind') textBinds.push(node)
			if (node.kind === 'ReactiveEventBind') eventBinds.push(node)
			if (node.kind === 'ReactiveBusyBind') busyBinds.push(node)
			if (node.kind === 'ReactiveComponentBind') componentBinds.push(node)
			if (node.kind === 'ReactiveShowBind') showBinds.push(node)
			if (node.kind === 'ReactiveHtmlBind') htmlBinds.push(node)
			if (node.kind === 'ReactiveClassBind') classBinds.push(node)
			if (node.kind === 'ReactiveAttributeBind') attributeBinds.push(node)
			if (node.kind === 'ReactivePropertyBind') propertyBinds.push(node)
			if (node.kind === 'ReactiveModelBind') modelBinds.push(node)
			if (node.kind === 'ReactiveIfBind') ifBinds.push(node)
			if (node.kind === 'ReactiveForBind') forBinds.push(node)
			if (node.kind === 'ReactiveSwitchBind') switchBinds.push(node)
			if (node.kind === 'For') {
				if (!node.reactive) walk(node.body)
				continue
			}
			if (node.kind === 'If') {
				if (!node.reactive) {
					walk(node.body)
					for (const branch of node.elseIf ?? []) walk(branch.body)
					if (node.else) walk(node.else)
				}
				continue
			}
			if (node.kind === 'Switch') {
				if (!node.reactive) {
					for (const branch of node.cases) walk(branch.body)
					if (node.defaultBody) walk(node.defaultBody)
				}
				continue
			}
			if (node.kind === 'Component') {
				for (const slotIR of Object.values(node.slots)) walk(slotIR)
			}
		}
	}

	walk(bodyIR)
	return {
		textBinds,
		eventBinds,
		busyBinds,
		componentBinds,
		showBinds,
		htmlBinds,
		classBinds,
		attributeBinds,
		propertyBinds,
		modelBinds,
		ifBinds,
		forBinds,
		switchBinds,
	}
}

function serializeBindings(analysis: StateScriptAnalysisResult): string {
	return JSON.stringify(
	analysis.bindings.map(binding => ({
			name: binding.name,
			derived: binding.derived,
			initExpr: binding.initExpr,
			dependencies: binding.dependencies,
			...(binding.reactiveProp ? { reactiveProp: true } : {}),
			...(binding.propName && binding.propName !== binding.name ? { propName: binding.propName } : {}),
			...(binding.reactiveProp ? { required: binding.required === true } : {}),
			...(binding.bindable ? { bindable: true } : {}),
		}))
	)
}

export function emitReactivePropsMetadata(analysis: StateScriptAnalysisResult): string {
	const reactiveProps = analysis.bindings
		.filter(binding => binding.reactiveProp)
		.map(binding => ({
			name: binding.name,
			propName: binding.propName ?? binding.name,
			required: binding.required === true,
			...(binding.bindable ? { bindable: true } : {}),
			...(binding.writes ? { writes: true } : {}),
		}))
	if (reactiveProps.length === 0) return ''
	return `export const __aeroReactiveProps = ${JSON.stringify(reactiveProps)}`
}

function emitCompiledMountFunctions(
	analysis: StateScriptAnalysisResult,
	binds: CollectedReactiveBinds,
	lowered: LoweredStateScript
): string {
	const owned = analysis.bindings.filter(binding => !binding.derived)
	const signalNames = new Set(owned.map(binding => binding.name))
	const rewriteContext = lowered.rewriteContext
	const scopeExpr = (expr: string) => rewriteExprForScope(expr, rewriteContext)
	const scopeStmt = (stmt: string, actions = false) =>
		rewriteStmtForScope(stmt, rewriteContext, {
			actionsNames: actions ? HYPERMEDIA_ACTION_NAMES : undefined,
		})
	const lines: string[] = []

	for (const line of lowered.moduleConstants) {
		lines.push(line)
	}

	for (const binding of analysis.bindings.filter(binding => !binding.derived)) {
		lines.push(
			`function __aeroInit_${binding.name}(scope) { return (${scopeExpr(binding.initExpr)}); }`
		)
	}
	for (const binding of analysis.bindings.filter(binding => binding.derived)) {
		lines.push(
			`function __aeroDerived_${binding.name}(scope) { return (${scopeExpr(binding.initExpr)}); }`
		)
	}
	if (lowered.scopeFunctions.length > 0) {
		lines.push(
			`function __aeroInstallScopeFunctions(scope) {\n${lowered.scopeFunctions.map(fn => fn.installSource).join('\n')}\n}`
		)
	}
	for (const bind of binds.textBinds) {
		lines.push(
			`function __aeroTextRead_${bind.bindId}(scope, escapeHtml) { return (${scopeExpr(bind.readExpr)}); }`
		)
	}
	for (const bind of binds.showBinds) {
		lines.push(`function __aeroShowRead_${bind.bindId}(scope) { return (${scopeExpr(bind.readExpr)}); }`)
	}
	for (const bind of binds.htmlBinds) {
		lines.push(`function __aeroHtmlRead_${bind.bindId}(scope) { return (${scopeExpr(bind.readExpr)}); }`)
	}
	for (const bind of binds.classBinds) {
		lines.push(
			`function __aeroClassRead_${bind.bindId}(scope) { return (${scopeExpr(bind.readExpr)}); }`
		)
	}
	for (const bind of binds.attributeBinds) {
		for (let i = 0; i < bind.attributes.length; i++) {
			const attr = bind.attributes[i]!
			lines.push(
				`function __aeroAttrRead_${bind.bindId}_${i}(scope) { return (${scopeExpr(attr.readExpr)}); }`
			)
		}
	}
	for (const bind of binds.propertyBinds) {
		lines.push(
			`function __aeroPropertyRead_${bind.bindId}(scope) { return (${scopeExpr(bind.readExpr)}); }`
		)
	}
	for (const bind of binds.modelBinds) {
		lines.push(
			`function __aeroModelRead_${bind.bindId}(scope) { return (${scopeExpr(bind.readExpr)}); }`
		)
		lines.push(
			`function __aeroModelWrite_${bind.bindId}(scope, $value) { ${scopeExpr(bind.writeExpr)} = $value; }`
		)
	}
	for (const bind of binds.eventBinds) {
		const body = rewriteHypermediaActionStateRefs(bind.handlerExpr, signalNames)
		const stmt = body.trim().endsWith(';') ? body.trim() : `${body.trim()};`
		lines.push(
			`function __aeroEvent_${bind.bindId}(scope, actions, event, self) { ${scopeStmt(stmt, true)} }`
		)
	}
	for (const bind of binds.ifBinds) {
		for (let i = 0; i < bind.branches.length; i++) {
			const branch = bind.branches[i]!
			if (branch.conditionExpr == null) continue
			lines.push(
				`function __aeroIfCond_${bind.bindId}_${i}(scope) { return (${scopeExpr(branch.conditionExpr)}); }`
			)
		}
	}
	for (const bind of binds.forBinds) {
		lines.push(`function __aeroForItems_${bind.bindId}(scope) { return (${scopeExpr(bind.itemsExpr)}); }`)
		lines.push(`function __aeroForKey_${bind.bindId}(scope) { return (${scopeExpr(bind.keyExpr)}); }`)
		if (needsForDestructureCodegen(bind.binding, bind.bindingNames)) {
			const pairs = bind.bindingNames.map(name => `${name}: item.${name}`).join(', ')
			lines.push(
				`function __aeroForDestructure_${bind.bindId}(item) { const ${bind.binding} = item; return ({ ${pairs} }); }`
			)
		}
	}
	for (const bind of binds.switchBinds) {
		lines.push(
			`function __aeroSwitchExpr_${bind.bindId}(scope) { return (${scopeExpr(bind.expression)}); }`
		)
		for (let i = 0; i < bind.cases.length; i++) {
			for (let j = 0; j < bind.cases[i]!.comparandExprs.length; j++) {
				const expr = bind.cases[i]!.comparandExprs[j]!
				lines.push(
					`function __aeroSwitchCmp_${bind.bindId}_${i}_${j}(scope) { return (${scopeExpr(expr)}); }`
				)
			}
		}
	}
	return lines.join('\n\n')
}

function serializeCompiledBindings(analysis: StateScriptAnalysisResult): string {
	const owned = analysis.bindings.filter(binding => !binding.derived)
	const derived = analysis.bindings.filter(binding => binding.derived)
	const rows = [
		...owned.map(binding => {
			const extras = [
				binding.reactiveProp ? 'reactiveProp: true' : '',
				binding.propName && binding.propName !== binding.name
					? `propName: ${JSON.stringify(binding.propName)}`
					: '',
				binding.reactiveProp && binding.required ? 'required: true' : '',
				binding.bindable ? 'bindable: true' : '',
			].filter(Boolean)
			return `\t\t{ name: ${JSON.stringify(binding.name)}, derived: false, init: __aeroInit_${binding.name}, dependencies: ${JSON.stringify(binding.dependencies)}${extras.length ? `, ${extras.join(', ')}` : ''} }`
		}),
		...derived.map(binding => {
			return `\t\t{ name: ${JSON.stringify(binding.name)}, derived: true, init: __aeroDerived_${binding.name}, dependencies: ${JSON.stringify(binding.dependencies)} }`
		}),
	]
	return `[\n${rows.join(',\n')}\n\t]`
}

function serializeTextBinds(binds: IRReactiveTextBind[]): string {
	if (binds.length === 0) return '[]'
	return `[\n${binds
		.map(
			bind =>
				`\t\t{ selector: ${JSON.stringify(`[data-aero-text="${bind.bindId}"]`)}, read: __aeroTextRead_${bind.bindId} },`
		)
		.join('\n')}\n\t]`
}

function serializeEventBinds(binds: IRReactiveEventBind[]): string {
	if (binds.length === 0) return '[]'
	return `[\n${binds
		.map(
			bind =>
				`\t\t{ selector: ${JSON.stringify(`[data-aero-event="${bind.bindId}"]`)}, event: ${JSON.stringify(bind.event)}, modifiers: ${JSON.stringify(bind.modifiers ?? [])}, handler: __aeroEvent_${bind.bindId} },`
		)
		.join('\n')}\n\t]`
}

export function createStateMountImportLine(): string {
	return `import { mountStateBindings as __aeroMountStateBindings } from '@aero-js/reactivity'`
}

function serializeBusyBinds(binds: IRReactiveBusyBind[]): string {
	return JSON.stringify(
		binds.map(bind => ({
			selector: `[data-aero-busy="${bind.bindId}"]`,
			readExpr: bind.readExpr,
		}))
	)
}

function serializeShowBinds(binds: IRReactiveShowBind[]): string {
	if (binds.length === 0) return '[]'
	return `[\n${binds
		.map(
			bind =>
				`\t\t{ selector: ${JSON.stringify(`[data-aero-show="${bind.bindId}"]`)}, read: __aeroShowRead_${bind.bindId} },`
		)
		.join('\n')}\n\t]`
}

function serializeHtmlBinds(binds: IRReactiveHtmlBind[]): string {
	if (binds.length === 0) return '[]'
	return `[\n${binds
		.map(
			bind =>
				`\t\t{ selector: ${JSON.stringify(`[data-aero-html="${bind.bindId}"]`)}, read: __aeroHtmlRead_${bind.bindId} },`
		)
		.join('\n')}\n\t]`
}

function serializeClassBinds(binds: IRReactiveClassBind[]): string {
	if (binds.length === 0) return '[]'
	return `[\n${binds
		.map(
			bind =>
				`\t\t{ selector: ${JSON.stringify(`[data-aero-class-${bind.className}="${bind.bindId}"]`)}, className: ${JSON.stringify(bind.className)}, read: __aeroClassRead_${bind.bindId} },`
		)
		.join('\n')}\n\t]`
}

function serializeAttributeBinds(binds: IRReactiveAttributeBind[]): string {
	if (binds.length === 0) return '[]'
	return `[\n${binds
		.map(bind => {
			const attributes = bind.attributes
				.map(
					(attr, index) =>
						`\t\t\t{ name: ${JSON.stringify(attr.name)}, read: __aeroAttrRead_${bind.bindId}_${index} }`
				)
				.join(',\n')
			return `\t\t{ selector: ${JSON.stringify(`[data-aero-bind="${bind.bindId}"]`)}, attributes: [\n${attributes}\n\t\t] }`
		})
		.join(',\n')}\n\t]`
}

function serializePropertyBinds(binds: IRReactivePropertyBind[]): string {
	if (binds.length === 0) return '[]'
	return `[\n${binds
		.map(
			bind =>
				`\t\t{ selector: ${JSON.stringify(`[data-aero-property-${bind.propertyName}="${bind.bindId}"]`)}, propertyName: ${JSON.stringify(bind.propertyName)}, read: __aeroPropertyRead_${bind.bindId} },`
		)
		.join('\n')}\n\t]`
}

function serializeModelBinds(binds: IRReactiveModelBind[]): string {
	if (binds.length === 0) return '[]'
	return `[\n${binds
		.map(bind => {
			const readonly = bind.readonly ? ', readonly: true' : ''
			return `\t\t{ selector: ${JSON.stringify(`[data-aero-model-${bind.modelKind}="${bind.bindId}"]`)}, modelKind: ${JSON.stringify(bind.modelKind)}, read: __aeroModelRead_${bind.bindId}, write: __aeroModelWrite_${bind.bindId}${readonly} },`
		})
		.join('\n')}\n\t]`
}

function collectAllCodegenBinds(binds: CollectedReactiveBinds): CollectedReactiveBinds {
	const merged: CollectedReactiveBinds = {
		textBinds: [...binds.textBinds],
		eventBinds: [...binds.eventBinds],
		busyBinds: [...binds.busyBinds],
		componentBinds: [...binds.componentBinds],
		showBinds: [...binds.showBinds],
		htmlBinds: [...binds.htmlBinds],
		classBinds: [...binds.classBinds],
		attributeBinds: [...binds.attributeBinds],
		propertyBinds: [...binds.propertyBinds],
		modelBinds: [...binds.modelBinds],
		ifBinds: [...binds.ifBinds],
		forBinds: [...binds.forBinds],
		switchBinds: [...binds.switchBinds],
	}

	const appendBranch = (branch: BranchReactiveBinds) => {
		merged.textBinds.push(...branch.textBinds)
		merged.eventBinds.push(...branch.eventBinds)
		merged.busyBinds.push(...branch.busyBinds)
		merged.showBinds.push(...branch.showBinds)
		merged.htmlBinds.push(...branch.htmlBinds)
		merged.classBinds.push(...branch.classBinds)
		merged.attributeBinds.push(...branch.attributeBinds)
		merged.propertyBinds.push(...branch.propertyBinds)
		merged.modelBinds.push(...branch.modelBinds)
	}

	for (const ifBind of binds.ifBinds) {
		for (const branch of ifBind.branches) appendBranch(collectBranchBinds(branch.body))
	}
	for (const forBind of binds.forBinds) appendBranch(collectBranchBinds(forBind.body))
	for (const switchBind of binds.switchBinds) {
		for (const branch of switchBind.cases) appendBranch(collectBranchBinds(branch.body))
		if (switchBind.defaultBody) appendBranch(collectBranchBinds(switchBind.defaultBody))
	}

	return merged
}

function serializeBranchMounts(branch: BranchReactiveBinds): string {
	return `{
			textBinds: ${serializeTextBinds(branch.textBinds)},
			eventBinds: ${serializeEventBinds(branch.eventBinds)},
			busyBinds: ${serializeBusyBinds(branch.busyBinds)},
			showBinds: ${serializeShowBinds(branch.showBinds)},
			htmlBinds: ${serializeHtmlBinds(branch.htmlBinds)},
			classBinds: ${serializeClassBinds(branch.classBinds)},
			attributeBinds: ${serializeAttributeBinds(branch.attributeBinds)},
			propertyBinds: ${serializePropertyBinds(branch.propertyBinds)},
			modelBinds: ${serializeModelBinds(branch.modelBinds)},
			componentBinds: []
		}`
}

function serializeIfBinds(ifBinds: IRReactiveIfBind[]): string {
	if (ifBinds.length === 0) return '[]'
	return `[\n${ifBinds
		.map(ifBind => {
			const branches = ifBind.branches
				.map((branch, index) => {
					const branchMounts = collectBranchBinds(branch.body)
					return `\t\t\t{
				condition: ${branch.conditionExpr == null ? 'null' : `__aeroIfCond_${ifBind.bindId}_${index}`},
				render: __aeroIfBranch_${ifBind.bindId}_${index},
				mounts: ${serializeBranchMounts(branchMounts)}
			}`
				})
				.join(',\n')
			return `\t\t{
			selector: ${JSON.stringify(`[data-aero-if="${ifBind.bindId}"]`)},
			branches: [
${branches}
			]
		}`
		})
		.join(',\n')}\n\t]`
}

function serializeForBinds(forBinds: IRReactiveForBind[]): string {
	if (forBinds.length === 0) return '[]'
	return `[\n${forBinds
		.map(forBind => {
			const rowMounts = collectBranchBinds(forBind.body)
			return `\t\t{
			selector: ${JSON.stringify(`[data-aero-for="${forBind.bindId}"]`)},
			binding: ${JSON.stringify(forBind.binding)},
			bindingNames: ${JSON.stringify(forBind.bindingNames)},
			items: __aeroForItems_${forBind.bindId},
			key: __aeroForKey_${forBind.bindId},${needsForDestructureCodegen(forBind.binding, forBind.bindingNames) ? `\n\t\t\tdestructureRow: __aeroForDestructure_${forBind.bindId},` : ''}
			renderRow: __aeroForRow_${forBind.bindId},
			rowMounts: ${serializeBranchMounts(rowMounts)}
		}`
		})
		.join(',\n')}\n\t]`
}

function serializeSwitchBinds(switchBinds: IRReactiveSwitchBind[]): string {
	if (switchBinds.length === 0) return '[]'
	return `[\n${switchBinds
		.map(switchBind => {
			const cases = switchBind.cases
				.map((branch, index) => {
					const branchMounts = collectBranchBinds(branch.body)
					const comparands = branch.comparandExprs
						.map((_, j) => `__aeroSwitchCmp_${switchBind.bindId}_${index}_${j}`)
						.join(', ')
					return `\t\t\t{
				comparands: [${comparands}],
				render: __aeroSwitchBranch_${switchBind.bindId}_${index},
				mounts: ${serializeBranchMounts(branchMounts)}
			}`
				})
				.join(',\n')
			const defaultBranch =
				switchBind.defaultBody !== undefined
					? (() => {
							const branchMounts = collectBranchBinds(switchBind.defaultBody)
							return `,
			default: {
				render: __aeroSwitchDefault_${switchBind.bindId},
				mounts: ${serializeBranchMounts(branchMounts)}
			}`
						})()
					: ''
			return `\t\t{
			selector: ${JSON.stringify(`[data-aero-switch="${switchBind.bindId}"]`)},
			discriminant: __aeroSwitchExpr_${switchBind.bindId},
			cases: [
${cases}
			]${defaultBranch}
		}`
		})
		.join(',\n')}\n\t]`
}

function serializeComponentBinds(
	binds: IRReactiveComponentBind[],
	defaultImportBindings: ReadonlySet<string>
): string {
	if (binds.length === 0) return '[]'
	return `[\n${binds
		.map(bind => {
			const componentExpr = defaultImportBindings.has(bind.componentExpr)
				? `__aeroMod_${bind.componentExpr}`
				: bind.componentExpr
			return `\t\t\t{ selector: ${JSON.stringify(`[data-aero-component="${bind.bindId}"]`)}, component: ${componentExpr}, reactivePropExprs: ${JSON.stringify(bind.reactivePropExprs)} }`
		})
		.join(',\n')}\n\t\t]`
}

function serializeScopeConstants(imports: readonly BuildScriptImport[]): string | null {
	const entries: string[] = []
	for (const imp of imports) {
		if (imp.defaultBinding) entries.push(`${imp.defaultBinding}: ${imp.defaultBinding}`)
		for (const binding of imp.namedBindings) {
			entries.push(`${binding.local}: ${binding.local}`)
		}
		if (imp.namespaceBinding) entries.push(`${imp.namespaceBinding}: ${imp.namespaceBinding}`)
	}
	if (entries.length === 0) return null
	return `{ ${entries.join(', ')} }`
}

export function emitForRowRenderer(forBind: IRReactiveForBind): string {
	const bodyJs = emitToJS(stripStructuralBranchOutVars(forBind.body), '__out')
	const scopedBodyJs = rewriteStmtForScope(bodyJs, new Set(forBind.bindingNames), {
		qualifyAllFreeIdentifiers: true,
	})
	return `function __aeroForRow_${forBind.bindId}(scope, Aero) {\n${STRUCTURAL_BRANCH_CONTEXT_DESTRUCTURE}\nlet __out = '';\n${scopedBodyJs}\nreturn __out;\n}`
}

function emitStructuralBranchFunctions(binds: CollectedReactiveBinds): string {
	const lines: string[] = []
	for (const ifBind of binds.ifBinds) {
		for (let i = 0; i < ifBind.branches.length; i++) {
			const branch = ifBind.branches[i]!
			lines.push(
				`function __aeroIfBranch_${ifBind.bindId}_${i}(Aero) {\n${STRUCTURAL_BRANCH_CONTEXT_DESTRUCTURE}\nlet __out = '';\n${emitToJS(stripStructuralBranchOutVars(branch.body), '__out')}\nreturn __out;\n}`
			)
		}
	}
	for (const forBind of binds.forBinds) {
		lines.push(emitForRowRenderer(forBind))
	}
	for (const switchBind of binds.switchBinds) {
		for (let i = 0; i < switchBind.cases.length; i++) {
			const branch = switchBind.cases[i]!
			lines.push(
				`function __aeroSwitchBranch_${switchBind.bindId}_${i}(Aero) {\n${STRUCTURAL_BRANCH_CONTEXT_DESTRUCTURE}\nlet __out = '';\n${emitToJS(stripStructuralBranchOutVars(branch.body), '__out')}\nreturn __out;\n}`
			)
		}
		if (switchBind.defaultBody !== undefined) {
			lines.push(
				`function __aeroSwitchDefault_${switchBind.bindId}(Aero) {\n${STRUCTURAL_BRANCH_CONTEXT_DESTRUCTURE}\nlet __out = '';\n${emitToJS(stripStructuralBranchOutVars(switchBind.defaultBody), '__out')}\nreturn __out;\n}`
			)
		}
	}
	return lines.join('\n\n')
}

function hasAnyBinds(binds: CollectedReactiveBinds): boolean {
	return (
		binds.textBinds.length > 0 ||
		binds.eventBinds.length > 0 ||
		binds.busyBinds.length > 0 ||
		binds.componentBinds.length > 0 ||
		binds.showBinds.length > 0 ||
		binds.htmlBinds.length > 0 ||
		binds.classBinds.length > 0 ||
		binds.attributeBinds.length > 0 ||
		binds.propertyBinds.length > 0 ||
		binds.modelBinds.length > 0 ||
		binds.ifBinds.length > 0 ||
		binds.forBinds.length > 0 ||
		binds.switchBinds.length > 0
	)
}

export function emitMountStateBindingsFunction(
	analysis: StateScriptAnalysisResult,
	binds: CollectedReactiveBinds,
	stateImports: readonly BuildScriptImport[] = [],
	actionFunctions?: string,
	defaultImportBindings: ReadonlySet<string> = new Set(),
	stateScriptSource = ''
): { preamble: string; mountExport: string } | '' {
	if (!hasAnyBinds(binds)) return ''

	const scopeConstants = serializeScopeConstants(stateImports)
	const scopeConstantsLine = scopeConstants ? `\n\t\tscopeConstants: ${scopeConstants},` : ''
	const actionFnsLine = actionFunctions
		? '\n\t\thypermediaRuntime: Aero.getHypermediaRuntime?.() ?? undefined,'
		: ''
	const branchFunctions = emitStructuralBranchFunctions(binds)
	const lowered = lowerStateScript(stateScriptSource, analysis, stateImports)
	const compiledFunctions = emitCompiledMountFunctions(
		analysis,
		collectAllCodegenBinds(binds),
		lowered
	)
	const preamble = [branchFunctions, compiledFunctions].filter(Boolean).join('\n\n')
	const installScopeLine =
		lowered.scopeFunctions.length > 0 ? '\n\t\tinstallScopeFunctions: __aeroInstallScopeFunctions,' : ''

	const mountExport = `export function mountStateBindings(root, Aero, opts = {}) {
	const runtime = Aero.getReactivityRuntime?.()
	if (!runtime) return () => {}
	return __aeroMountStateBindings({
		root,
		store: opts.store ?? runtime.store,
		reactiveProps: opts.reactiveProps ?? {},
		bindings: ${serializeCompiledBindings(analysis)},${installScopeLine}
		textBinds: ${serializeTextBinds(binds.textBinds)},
		eventBinds: ${serializeEventBinds(binds.eventBinds)},
		busyBinds: ${serializeBusyBinds(binds.busyBinds)},
		showBinds: ${serializeShowBinds(binds.showBinds)},
		htmlBinds: ${serializeHtmlBinds(binds.htmlBinds)},
		classBinds: ${serializeClassBinds(binds.classBinds)},
		attributeBinds: ${serializeAttributeBinds(binds.attributeBinds)},
		propertyBinds: ${serializePropertyBinds(binds.propertyBinds)},
		modelBinds: ${serializeModelBinds(binds.modelBinds)},
		ifBinds: ${serializeIfBinds(binds.ifBinds)},
		forBinds: ${serializeForBinds(binds.forBinds)},
		switchBinds: ${serializeSwitchBinds(binds.switchBinds)},${scopeConstantsLine}
		componentBinds: ${serializeComponentBinds(binds.componentBinds, defaultImportBindings)},
		escapeHtml: Aero.escapeHtml,${actionFnsLine}
		Aero,
	})
}`.trim()

	return { preamble, mountExport }
}

export function createHypermediaImportLine(): string {
	return ''
}

export function referencesStateBindingExpression(
	expression: string,
	bindingNames: ReadonlySet<string>
): boolean {
	for (const name of bindingNames) {
		if (new RegExp(`\\b${name}\\b`).test(expression)) return true
	}
	return false
}

export function textReferencesStateBindings(
	text: string,
	bindingNames: ReadonlySet<string>,
	tokenize: (text: string) => Array<{ kind: string; expression?: string }>
): boolean {
	for (const segment of tokenize(text)) {
		if (segment.kind !== 'interpolation') continue
		const expr = segment.expression?.trim() ?? ''
		if (!expr) continue
		if (referencesStateBindingExpression(expr, bindingNames)) return true
	}
	return false
}
