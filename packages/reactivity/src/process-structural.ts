import type { Cleanup } from './mount'
import { SignalStore } from './store'
import { bindReactiveIf, type ReactiveIfBranchSpec } from './structural/if'
import { bindKeyedFor } from './structural/for'
import { bindReactiveSwitch } from './structural/switch'
import type { StateScope } from './state-scope'
import {
	compileRestrictedCondition,
	compileRestrictedIterable,
	compileRestrictedRead,
	compileRestrictedRowKey,
} from './restricted-runtime-read'

export type RuntimeReadCompiler = (expr: string, store: SignalStore) => () => unknown

function setInnerHtml(node: ParentNode, html: string): void {
	if (node instanceof Element) {
		node.innerHTML = html
	}
}

/** @internal Eval-based reader for unsafeProcessFragment only. */
export function compileUnsafeRuntimeRead(expr: string, store: SignalStore): () => unknown {
	const code = expr.replace(/\$(\w+(?:\.\w+)*)/g, (_, path: string) => {
		return `store.get(${JSON.stringify(path)}).value`
	})
	// eslint-disable-next-line @typescript-eslint/no-implied-eval
	return new Function('store', `return function() { return (${code}); }`)(store) as () => unknown
}

export const compileRestrictedRuntimeRead: RuntimeReadCompiler = compileRestrictedRead

function isElementLike(node: unknown): node is Element {
	return (
		typeof node === 'object' &&
		node != null &&
		'getAttribute' in node &&
		'setAttribute' in node &&
		'children' in node
	)
}

function isTemplateLike(node: unknown): node is HTMLTemplateElement {
	return isElementLike(node) && 'innerHTML' in node && (node as Element).tagName === 'TEMPLATE'
}

export function isCompiledBindMarker(value: string | null): boolean {
	return value != null && /^\d+$/.test(value.trim())
}

function isQuotedStringLiteral(expr: string): boolean {
	const trimmed = expr.trim()
	return (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	)
}

function parseCaseComparand(
	raw: string,
	store: SignalStore,
	compileRead: RuntimeReadCompiler
): () => unknown {
	const trimmed = raw.trim()
	if (trimmed.startsWith('$')) return compileRead(trimmed, store)
	if (isQuotedStringLiteral(trimmed)) {
		return () => JSON.parse(trimmed.replace(/^'|'$/g, '"'))
	}
	if (compileRead === compileRestrictedRuntimeRead) {
		return () => trimmed
	}
	return compileRead(trimmed, store)
}

function createProcessScope(_store: SignalStore): StateScope {
	return Object.create(null) as StateScope
}

export interface WireProcessStructuralOptions {
	readonly element: ParentNode
	readonly store: SignalStore
	readonly processNested: (element: ParentNode) => Cleanup
	readonly compileRead?: RuntimeReadCompiler
}

export function wireProcessStructuralBindings(options: WireProcessStructuralOptions): Cleanup[] {
	const { element, store, processNested } = options
	const compileRead = options.compileRead ?? compileRestrictedRuntimeRead
	const cleanups: Cleanup[] = []
	const scope = createProcessScope(store)

	for (const anchor of element.querySelectorAll?.('[data-aero-switch]') ?? []) {
		if (!isElementLike(anchor)) continue
		const expr = anchor.getAttribute('data-aero-switch')
		if (!expr || isCompiledBindMarker(expr)) continue

		const cases: Array<{
			comparandExprs: readonly string[]
			renderHtml: () => string
			mountBranch: (branchRoot: ParentNode) => Cleanup
		}> = []
		let defaultBranch:
			| {
					renderHtml: () => string
					mountBranch: (branchRoot: ParentNode) => Cleanup
			  }
			| undefined

		for (const child of [...anchor.children]) {
			if (!isTemplateLike(child)) continue
			if (child.hasAttribute('data-aero-case')) {
				const caseValue = child.getAttribute('data-aero-case') ?? ''
				const comparandRead = parseCaseComparand(caseValue, store, compileRead)
				const caseIndex = cases.length
				Object.defineProperty(scope, `__aeroCase_${caseIndex}`, {
					configurable: true,
					get: comparandRead,
				})
				cases.push({
					comparandExprs: [`__aeroCase_${caseIndex}`],
					renderHtml: () => child.innerHTML,
					mountBranch: branchRoot => {
						setInnerHtml(branchRoot, child.innerHTML)
						return processNested(branchRoot)
					},
				})
			}
			if (child.hasAttribute('data-aero-default')) {
				defaultBranch = {
					renderHtml: () => child.innerHTML,
					mountBranch: branchRoot => {
						setInnerHtml(branchRoot, child.innerHTML)
						return processNested(branchRoot)
					},
				}
			}
			child.remove()
		}

		Object.defineProperty(scope, '__aeroSwitchDisc', {
			configurable: true,
			get: () => compileRead(expr, store)(),
		})

		cleanups.push(
			bindReactiveSwitch({
				mountTarget: { kind: 'element', element: anchor },
				scope,
				expression: '__aeroSwitchDisc',
				cases,
				...(defaultBranch ? { defaultBranch } : {}),
			})
		)
		anchor.setAttribute('data-aero-processed', '')
	}

	for (const anchor of element.querySelectorAll?.('[data-aero-if]') ?? []) {
		if (!isElementLike(anchor)) continue
		const marker = anchor.getAttribute('data-aero-if')
		if (marker != null && marker !== '' && isCompiledBindMarker(marker)) continue

		const branches: ReactiveIfBranchSpec[] = []
		for (const child of [...anchor.children]) {
			if (!isTemplateLike(child)) continue
			if (child.hasAttribute('data-aero-when')) {
				const when = child.getAttribute('data-aero-when') ?? ''
				const branchIndex = branches.length
				Object.defineProperty(scope, `__aeroWhen_${branchIndex}`, {
					configurable: true,
					get: () => Boolean(compileRestrictedCondition(when, store)()),
				})
				branches.push({
					conditionExpr: `__aeroWhen_${branchIndex}`,
					renderHtml: () => child.innerHTML,
					mountBranch: branchRoot => {
						setInnerHtml(branchRoot, child.innerHTML)
						return processNested(branchRoot)
					},
				})
			} else if (child.hasAttribute('data-aero-default')) {
				branches.push({
					conditionExpr: null,
					renderHtml: () => child.innerHTML,
					mountBranch: branchRoot => {
						setInnerHtml(branchRoot, child.innerHTML)
						return processNested(branchRoot)
					},
				})
			}
			child.remove()
		}

		if (branches.length === 0) continue

		cleanups.push(
			bindReactiveIf({
				mountTarget: { kind: 'element', element: anchor },
				scope,
				branches,
			})
		)
		anchor.setAttribute('data-aero-processed', '')
	}

	for (const containerEl of element.querySelectorAll?.('[data-aero-for]') ?? []) {
		if (!isElementLike(containerEl)) continue
		const itemsExpr = containerEl.getAttribute('data-aero-for')
		if (!itemsExpr || isCompiledBindMarker(itemsExpr)) continue

		const bindingName = containerEl.getAttribute('data-aero-as') ?? 'item'
		const rowTemplate = containerEl.querySelector(':scope > template[data-aero-for-row]')
		if (!isTemplateLike(rowTemplate)) continue

		const keyExprRaw = rowTemplate.getAttribute('data-aero-key') ?? ''
		const rowHtml = rowTemplate.innerHTML
		rowTemplate.remove()

		Object.defineProperty(scope, '__aeroItems', {
			configurable: true,
			get: () => compileRestrictedIterable(itemsExpr, store)(),
		})

		cleanups.push(
			bindKeyedFor({
				mountTarget: { kind: 'element', element: containerEl },
				scope,
				itemsExpr: '__aeroItems',
				keyExpr: keyExprRaw.trim().startsWith('$')
					? keyExprRaw.trim().slice(1)
					: keyExprRaw.trim(),
				binding: bindingName,
				bindingNames: [bindingName],
				renderRow: rowScope => {
					const keyRead = compileRestrictedRowKey(keyExprRaw.trim(), rowScope)
					return {
						key: String(keyRead()),
						renderHtml: () => rowHtml,
						mountRow: rowRoot => {
							setInnerHtml(rowRoot, rowHtml)
							return processNested(rowRoot)
						},
					}
				},
			})
		)
		containerEl.setAttribute('data-aero-processed', '')
	}

	return cleanups
}
