import { Effect } from '../effect'
import type { Cleanup } from '../mount'
import { compileScopeRead } from '../scope-eval'
import type { StateScope } from '../state-scope'

export interface ReactiveSwitchCaseSpec {
	readonly comparandExprs: readonly string[]
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
	readonly expression: string
	readonly cases: readonly ReactiveSwitchCaseSpec[]
	readonly defaultBranch?: ReactiveSwitchDefaultSpec
}

function evalDiscriminant(expression: string, scope: StateScope): unknown {
	return compileScopeRead(expression, scope)()
}

function evalComparand(comparandExpr: string, scope: StateScope): unknown {
	return compileScopeRead(comparandExpr, scope)()
}

function findActiveSwitchBranchIndex(
	expression: string,
	cases: readonly ReactiveSwitchCaseSpec[],
	hasDefault: boolean,
	scope: StateScope
): number {
	const discriminant = evalDiscriminant(expression, scope)
	for (let i = 0; i < cases.length; i++) {
		const caseBranch = cases[i]!
		for (const comparandExpr of caseBranch.comparandExprs) {
			if (discriminant === evalComparand(comparandExpr, scope)) return i
		}
	}
	return hasDefault ? cases.length : -1
}

export function bindReactiveSwitch(options: BindReactiveSwitchOptions): Cleanup {
	const { anchor, scope, expression, cases, defaultBranch } = options
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
		activateBranch(
			findActiveSwitchBranchIndex(expression, cases, defaultBranch != null, scope)
		)
	})

	return () => {
		effect.destroy()
		branchCleanup?.()
	}
}
