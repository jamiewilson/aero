import { Effect } from '../effect'
import type { Cleanup } from '../mount'
import { compileScopeRead } from '../scope-eval'
import type { StateScope } from '../state-scope'

export interface ReactiveSwitchCaseSpec {
	readonly comparandExprs?: readonly string[]
	readonly comparands?: readonly ((scope: StateScope) => unknown)[]
	readonly renderHtml: () => string
	readonly mountBranch: (branchRoot: ParentNode) => Cleanup
}

export interface ReactiveSwitchDefaultSpec {
	readonly renderHtml: () => string
	readonly mountBranch: (branchRoot: ParentNode) => Cleanup
}

export interface BindReactiveSwitchOptions {
	readonly anchor: Element
	readonly scope: StateScope
	readonly expression?: string
	readonly discriminant?: (scope: StateScope) => unknown
	readonly cases: readonly ReactiveSwitchCaseSpec[]
	readonly defaultBranch?: ReactiveSwitchDefaultSpec
}

function evalDiscriminant(options: BindReactiveSwitchOptions, scope: StateScope): unknown {
	if (options.discriminant) return options.discriminant(scope)
	if (options.expression) return compileScopeRead(options.expression, scope)()
	throw new Error('[aero] Reactive switch requires a compiled discriminant.')
}

function evalComparand(
	caseBranch: ReactiveSwitchCaseSpec,
	index: number,
	scope: StateScope
): unknown {
	const compiled = caseBranch.comparands?.[index]
	if (compiled) return compiled(scope)
	const expr = caseBranch.comparandExprs?.[index]
	if (expr) return compileScopeRead(expr, scope)()
	throw new Error('[aero] Reactive switch case requires a compiled comparand.')
}

function findActiveSwitchBranchIndex(
	options: BindReactiveSwitchOptions,
	scope: StateScope
): number {
	const { cases, defaultBranch } = options
	const discriminant = evalDiscriminant(options, scope)
	for (let i = 0; i < cases.length; i++) {
		const caseBranch = cases[i]!
		const count = caseBranch.comparands?.length ?? caseBranch.comparandExprs?.length ?? 0
		for (let j = 0; j < count; j++) {
			if (discriminant === evalComparand(caseBranch, j, scope)) return i
		}
	}
	return defaultBranch != null ? cases.length : -1
}

export function bindReactiveSwitch(options: BindReactiveSwitchOptions): Cleanup {
	const { anchor, scope, cases, defaultBranch } = options
	let activeIndex = -1
	let branchCleanup: Cleanup | null = null

	const activateBranch = (index: number): void => {
		if (index === activeIndex) return
		branchCleanup?.()
		branchCleanup = null
		activeIndex = index
		if (index < 0) {
			anchor.innerHTML = ''
			return
		}
		if (index < cases.length) {
			const branch = cases[index]!
			anchor.innerHTML = branch.renderHtml()
			branchCleanup = branch.mountBranch(anchor)
			return
		}
		if (!defaultBranch) return
		anchor.innerHTML = defaultBranch.renderHtml()
		branchCleanup = defaultBranch.mountBranch(anchor)
	}

	const effect = new Effect(() => {
		activateBranch(findActiveSwitchBranchIndex(options, scope))
	})

	return () => {
		effect.destroy()
		branchCleanup?.()
	}
}
