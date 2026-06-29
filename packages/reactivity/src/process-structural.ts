import type { Cleanup } from './mount'
import { SignalStore } from './store'
import { bindReactiveIf, type ReactiveIfBranchSpec } from './structural/if'
import { bindKeyedFor } from './structural/for'
import { bindReactiveSwitch } from './structural/switch'
import { compileScopeRead } from './scope-eval'
import type { StateScope } from './state-scope'

export function compileRuntimeRead(expr: string, store: SignalStore): () => unknown {
	const code = expr.replace(/\$(\w+(?:\.\w+)*)/g, (_, path: string) => {
		return `store.get(${JSON.stringify(path)}).value`
	})
	// eslint-disable-next-line @typescript-eslint/no-implied-eval
	return new Function('store', `return function() { return (${code}); }`)(store) as () => unknown
}

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

function isCompiledBindMarker(value: string | null): boolean {
	return value != null && /^\d+$/.test(value.trim())
}

function parseCaseComparand(raw: string, store: SignalStore): () => unknown {
	const trimmed = raw.trim()
	if (trimmed.startsWith('$')) return compileRuntimeRead(trimmed, store)
	return () => {
		if (
			(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
			(trimmed.startsWith("'") && trimmed.endsWith("'"))
		) {
			return JSON.parse(trimmed.replace(/^'|'$/g, '"'))
		}
		return trimmed
	}
}

function createProcessScope(_store: SignalStore): StateScope {
	return Object.create(null) as StateScope
}

export interface WireProcessStructuralOptions {
	readonly element: ParentNode
	readonly store: SignalStore
	readonly processNested: (element: ParentNode) => Cleanup
}

export function wireProcessStructuralBindings(options: WireProcessStructuralOptions): Cleanup[] {
	const { element, store, processNested } = options
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
				const comparandRead = parseCaseComparand(caseValue, store)
				const caseIndex = cases.length
				Object.defineProperty(scope, `__aeroCase_${caseIndex}`, {
					configurable: true,
					get: comparandRead,
				})
				cases.push({
					comparandExprs: [`__aeroCase_${caseIndex}`],
					renderHtml: () => child.innerHTML,
					mountBranch: branchRoot => {
						branchRoot.innerHTML = child.innerHTML
						return processNested(branchRoot)
					},
				})
			}
			if (child.hasAttribute('data-aero-default')) {
				defaultBranch = {
					renderHtml: () => child.innerHTML,
					mountBranch: branchRoot => {
						branchRoot.innerHTML = child.innerHTML
						return processNested(branchRoot)
					},
				}
			}
			child.remove()
		}

		Object.defineProperty(scope, '__aeroSwitchDisc', {
			configurable: true,
			get: () => compileRuntimeRead(expr, store)(),
		})

		cleanups.push(
			bindReactiveSwitch({
				anchor,
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
					get: () => Boolean(compileRuntimeRead(when, store)()),
				})
				branches.push({
					conditionExpr: `__aeroWhen_${branchIndex}`,
					renderHtml: () => child.innerHTML,
					mountBranch: branchRoot => {
						branchRoot.innerHTML = child.innerHTML
						return processNested(branchRoot)
					},
				})
			} else if (child.hasAttribute('data-aero-default')) {
				branches.push({
					conditionExpr: null,
					renderHtml: () => child.innerHTML,
					mountBranch: branchRoot => {
						branchRoot.innerHTML = child.innerHTML
						return processNested(branchRoot)
					},
				})
			}
			child.remove()
		}

		if (branches.length === 0) continue

		cleanups.push(
			bindReactiveIf({
				anchor,
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
			get: () => {
				const value = compileRuntimeRead(itemsExpr, store)()
				if (value == null) return []
				if (!Array.isArray(value)) {
					throw new Error('[aero] Reactive for loop iterable must be an array.')
				}
				return value
			},
		})

		cleanups.push(
			bindKeyedFor({
				container: containerEl,
				scope,
				itemsExpr: '__aeroItems',
				keyExpr: keyExprRaw.trim().startsWith('$')
					? keyExprRaw.trim().slice(1)
					: keyExprRaw.trim(),
				binding: bindingName,
				bindingNames: [bindingName],
				renderRow: rowScope => {
					const keyRead = compileScopeRead(
						keyExprRaw.trim().startsWith('$')
							? keyExprRaw.trim().slice(1)
							: keyExprRaw.trim(),
						rowScope
					)
					return {
						key: String(keyRead()),
						renderHtml: () => rowHtml,
						mountRow: rowRoot => {
							rowRoot.innerHTML = rowHtml
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
