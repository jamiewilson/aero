import type {
	IRNode,
	IRReactiveBusyBind,
	IRReactiveClassBind,
	IRReactiveComponentBind,
	IRReactiveEventBind,
	IRReactiveForBind,
	IRReactiveHtmlBind,
	IRReactiveIfBind,
	IRReactiveModelBind,
	IRReactivePropertyBind,
	IRReactiveShowBind,
	IRReactiveTextBind,
} from './ir'
import type { BuildScriptImport } from './build-script-analysis'
import type { StateScriptAnalysisResult } from './state-script-analysis'
import { emitToJS } from './emit'

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
	propertyBinds: IRReactivePropertyBind[]
	modelBinds: IRReactiveModelBind[]
	ifBinds: IRReactiveIfBind[]
	forBinds: IRReactiveForBind[]
}

function collectBranchBinds(body: IRNode[]): BranchReactiveBinds {
	const branch: BranchReactiveBinds = {
		textBinds: [],
		eventBinds: [],
		busyBinds: [],
		showBinds: [],
		htmlBinds: [],
		classBinds: [],
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
	const propertyBinds: IRReactivePropertyBind[] = []
	const modelBinds: IRReactiveModelBind[] = []
	const ifBinds: IRReactiveIfBind[] = []
	const forBinds: IRReactiveForBind[] = []

	function walk(nodes: IRNode[]): void {
		for (const node of nodes) {
			if (node.kind === 'ReactiveTextBind') textBinds.push(node)
			if (node.kind === 'ReactiveEventBind') eventBinds.push(node)
			if (node.kind === 'ReactiveBusyBind') busyBinds.push(node)
			if (node.kind === 'ReactiveComponentBind') componentBinds.push(node)
			if (node.kind === 'ReactiveShowBind') showBinds.push(node)
			if (node.kind === 'ReactiveHtmlBind') htmlBinds.push(node)
			if (node.kind === 'ReactiveClassBind') classBinds.push(node)
			if (node.kind === 'ReactivePropertyBind') propertyBinds.push(node)
			if (node.kind === 'ReactiveModelBind') modelBinds.push(node)
			if (node.kind === 'ReactiveIfBind') ifBinds.push(node)
			if (node.kind === 'ReactiveForBind') forBinds.push(node)
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
				for (const branch of node.cases) walk(branch.body)
				if (node.defaultBody) walk(node.defaultBody)
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
		propertyBinds,
		modelBinds,
		ifBinds,
		forBinds,
	}
}

function serializeBindings(analysis: StateScriptAnalysisResult): string {
	return JSON.stringify(
	analysis.bindings.map(binding => ({
			name: binding.name,
			derived: binding.derived,
			initExpr: binding.initExpr,
			dependencies: binding.dependencies,
			...(binding.liveProp ? { liveProp: true } : {}),
			...(binding.propName && binding.propName !== binding.name ? { propName: binding.propName } : {}),
			...(binding.liveProp ? { required: binding.required === true } : {}),
			...(binding.bindable ? { bindable: true } : {}),
		}))
	)
}

export function emitLivePropsMetadata(analysis: StateScriptAnalysisResult): string {
	const liveProps = analysis.bindings
		.filter(binding => binding.liveProp)
		.map(binding => ({
			name: binding.name,
			propName: binding.propName ?? binding.name,
			required: binding.required === true,
			...(binding.bindable ? { bindable: true } : {}),
			...(binding.writes ? { writes: true } : {}),
		}))
	if (liveProps.length === 0) return ''
	return `export const __aeroLiveProps = ${JSON.stringify(liveProps)}`
}

function serializeFunctionSources(analysis: StateScriptAnalysisResult): string {
	return JSON.stringify(analysis.functionSources)
}

function serializeTextBinds(binds: IRReactiveTextBind[]): string {
	return JSON.stringify(
		binds.map(bind => ({
			selector: `[data-aero-text="${bind.bindId}"]`,
			readExpr: bind.readExpr,
		}))
	)
}

function serializeEventBinds(binds: IRReactiveEventBind[]): string {
	return JSON.stringify(
		binds.map(bind => ({
			selector: `[data-aero-event="${bind.bindId}"]`,
			event: bind.event,
			modifiers: bind.modifiers,
			handlerExpr: bind.handlerExpr,
		}))
	)
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
	return JSON.stringify(
		binds.map(bind => ({
			selector: `[data-aero-show="${bind.bindId}"]`,
			readExpr: bind.readExpr,
		}))
	)
}

function serializeHtmlBinds(binds: IRReactiveHtmlBind[]): string {
	return JSON.stringify(
		binds.map(bind => ({
			selector: `[data-aero-html="${bind.bindId}"]`,
			readExpr: bind.readExpr,
		}))
	)
}

function serializeClassBinds(binds: IRReactiveClassBind[]): string {
	return JSON.stringify(
		binds.map(bind => ({
			selector: `[data-aero-class-${bind.className}="${bind.bindId}"]`,
			className: bind.className,
			readExpr: bind.readExpr,
		}))
	)
}

function serializePropertyBinds(binds: IRReactivePropertyBind[]): string {
	return JSON.stringify(
		binds.map(bind => ({
			selector: `[data-aero-property-${bind.propertyName}="${bind.bindId}"]`,
			propertyName: bind.propertyName,
			readExpr: bind.readExpr,
		}))
	)
}

function serializeModelBinds(binds: IRReactiveModelBind[]): string {
	return JSON.stringify(
		binds.map(bind => ({
			selector: `[data-aero-model-${bind.modelKind}="${bind.bindId}"]`,
			modelKind: bind.modelKind,
			readExpr: bind.readExpr,
			writeExpr: bind.writeExpr,
			...(bind.readonly ? { readonly: true } : {}),
		}))
	)
}

function serializeBranchMounts(branch: BranchReactiveBinds): string {
	return `{
			textBinds: ${serializeTextBinds(branch.textBinds)},
			eventBinds: ${serializeEventBinds(branch.eventBinds)},
			busyBinds: ${serializeBusyBinds(branch.busyBinds)},
			showBinds: ${serializeShowBinds(branch.showBinds)},
			htmlBinds: ${serializeHtmlBinds(branch.htmlBinds)},
			classBinds: ${serializeClassBinds(branch.classBinds)},
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
				conditionExpr: ${branch.conditionExpr == null ? 'null' : JSON.stringify(branch.conditionExpr)},
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
			itemsExpr: ${JSON.stringify(forBind.itemsExpr)},
			keyExpr: ${JSON.stringify(forBind.keyExpr)},
			renderRow: __aeroForRow_${forBind.bindId},
			rowMounts: ${serializeBranchMounts(rowMounts)}
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
			return `\t\t\t{ selector: ${JSON.stringify(`[data-aero-component="${bind.bindId}"]`)}, component: ${componentExpr}, livePropExprs: ${JSON.stringify(bind.livePropExprs)} }`
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

export function emitStructuralBranchFunctions(binds: CollectedReactiveBinds): string {
	const lines: string[] = []
	for (const ifBind of binds.ifBinds) {
		for (let i = 0; i < ifBind.branches.length; i++) {
			const branch = ifBind.branches[i]!
			lines.push(
				`function __aeroIfBranch_${ifBind.bindId}_${i}(Aero) {\nlet __out = '';\n${emitToJS(stripStructuralBranchOutVars(branch.body), '__out')}\nreturn __out;\n}`
			)
		}
	}
	for (const forBind of binds.forBinds) {
		lines.push(
			`function __aeroForRow_${forBind.bindId}(Aero) {\nlet __out = '';\n${emitToJS(stripStructuralBranchOutVars(forBind.body), '__out')}\nreturn __out;\n}`
		)
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
		binds.propertyBinds.length > 0 ||
		binds.modelBinds.length > 0 ||
		binds.ifBinds.length > 0 ||
		binds.forBinds.length > 0
	)
}

export function emitMountStateBindingsFunction(
	analysis: StateScriptAnalysisResult,
	binds: CollectedReactiveBinds,
	stateImports: readonly BuildScriptImport[] = [],
	actionFunctions?: string,
	defaultImportBindings: ReadonlySet<string> = new Set()
): string {
	if (!hasAnyBinds(binds)) return ''

	const scopeConstants = serializeScopeConstants(stateImports)
	const scopeConstantsLine = scopeConstants ? `\n\t\tscopeConstants: ${scopeConstants},` : ''
	const actionFnsLine = actionFunctions
		? '\n\t\thypermediaRuntime: Aero.getHypermediaRuntime?.() ?? undefined,'
		: ''
	const branchFunctions = emitStructuralBranchFunctions(binds)
	const branchFunctionsBlock = branchFunctions ? `${branchFunctions}\n\n` : ''

	return `${branchFunctionsBlock}
export function mountStateBindings(root, Aero, opts = {}) {
	const runtime = Aero.getReactivityRuntime?.()
	if (!runtime) return () => {}
	return __aeroMountStateBindings({
		root,
		store: opts.store ?? runtime.store,
		liveProps: opts.liveProps ?? {},
		bindings: ${serializeBindings(analysis)},
		functionSources: ${serializeFunctionSources(analysis)},
		textBinds: ${serializeTextBinds(binds.textBinds)},
		eventBinds: ${serializeEventBinds(binds.eventBinds)},
		busyBinds: ${serializeBusyBinds(binds.busyBinds)},
		showBinds: ${serializeShowBinds(binds.showBinds)},
		htmlBinds: ${serializeHtmlBinds(binds.htmlBinds)},
		classBinds: ${serializeClassBinds(binds.classBinds)},
		propertyBinds: ${serializePropertyBinds(binds.propertyBinds)},
		modelBinds: ${serializeModelBinds(binds.modelBinds)},
		ifBinds: ${serializeIfBinds(binds.ifBinds)},
		forBinds: ${serializeForBinds(binds.forBinds)},${scopeConstantsLine}
		componentBinds: ${serializeComponentBinds(binds.componentBinds, defaultImportBindings)},
		escapeHtml: Aero.escapeHtml,${actionFnsLine}
		Aero,
	})
}`.trim()
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
