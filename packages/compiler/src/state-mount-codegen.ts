import type {
	IRNode,
	IRReactiveBusyBind,
	IRReactiveComponentBind,
	IRReactiveEventBind,
	IRReactiveTextBind,
} from './ir'
import type { BuildScriptImport } from './build-script-analysis'
import type { StateScriptAnalysisResult } from './state-script-analysis'

export interface CollectedReactiveBinds {
	textBinds: IRReactiveTextBind[]
	eventBinds: IRReactiveEventBind[]
	busyBinds: IRReactiveBusyBind[]
	componentBinds: IRReactiveComponentBind[]
}

export function collectReactiveBinds(bodyIR: IRNode[]): CollectedReactiveBinds {
	const textBinds: IRReactiveTextBind[] = []
	const eventBinds: IRReactiveEventBind[] = []
	const busyBinds: IRReactiveBusyBind[] = []
	const componentBinds: IRReactiveComponentBind[] = []

	function walk(nodes: IRNode[]): void {
		for (const node of nodes) {
			if (node.kind === 'ReactiveTextBind') textBinds.push(node)
			if (node.kind === 'ReactiveEventBind') eventBinds.push(node)
			if (node.kind === 'ReactiveBusyBind') busyBinds.push(node)
			if (node.kind === 'ReactiveComponentBind') componentBinds.push(node)
			if (node.kind === 'For' || node.kind === 'If') {
				walk(node.body)
				if (node.kind === 'If') {
					for (const branch of node.elseIf ?? []) walk(branch.body)
					if (node.else) walk(node.else)
				}
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
	return { textBinds, eventBinds, busyBinds, componentBinds }
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
			...(binding.readonly ? { readonly: true } : {}),
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
			...(binding.readonly ? { readonly: true } : {}),
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

function serializeComponentBinds(binds: IRReactiveComponentBind[]): string {
	if (binds.length === 0) return '[]'
	return `[\n${binds
		.map(
			bind =>
				`\t\t\t{ selector: ${JSON.stringify(`[data-aero-component="${bind.bindId}"]`)}, component: ${bind.componentExpr}, livePropExprs: ${JSON.stringify(bind.livePropExprs)} }`
		)
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

export function emitMountStateBindingsFunction(
	analysis: StateScriptAnalysisResult,
	binds: CollectedReactiveBinds,
	stateImports: readonly BuildScriptImport[] = [],
	actionFunctions?: string
): string {
	if (
		binds.textBinds.length === 0 &&
		binds.eventBinds.length === 0 &&
		binds.busyBinds.length === 0 &&
		binds.componentBinds.length === 0
	) return ''

	const scopeConstants = serializeScopeConstants(stateImports)
	const scopeConstantsLine = scopeConstants ? `\n\t\tscopeConstants: ${scopeConstants},` : ''
	const actionFnsLine = actionFunctions
		? '\n\t\thypermediaRuntime: Aero.getHypermediaRuntime?.() ?? undefined,'
		: ''

	return `
export function mountStateBindings(root, Aero, opts = {}) {
	const runtime = Aero.getReactivityRuntime?.()
	if (!runtime) return () => {}
	return __aeroMountStateBindings({
		root,
		store: runtime.store,
		liveProps: opts.liveProps ?? {},
		bindings: ${serializeBindings(analysis)},
		functionSources: ${serializeFunctionSources(analysis)},
		textBinds: ${serializeTextBinds(binds.textBinds)},
		eventBinds: ${serializeEventBinds(binds.eventBinds)},
		busyBinds: ${serializeBusyBinds(binds.busyBinds)},${scopeConstantsLine}
		componentBinds: ${serializeComponentBinds(binds.componentBinds)},
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
