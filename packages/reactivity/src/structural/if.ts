import { Effect } from '../effect'
import type { Cleanup } from '../mount'
import { evalScopeCondition } from '../scope-eval'
import type { StateScope } from '../state-scope'

export interface ReactiveIfBranchSpec {
	readonly conditionExpr: string | null
	readonly renderHtml: () => string
	readonly mountBranch: (branchRoot: ParentNode) => Cleanup
}

export interface BindReactiveIfOptions {
	readonly anchor: Element
	readonly scope: StateScope
	readonly branches: readonly ReactiveIfBranchSpec[]
}

function findActiveBranchIndex(
	branches: readonly ReactiveIfBranchSpec[],
	scope: StateScope
): number {
	for (let i = 0; i < branches.length; i++) {
		const branch = branches[i]!
		if (branch.conditionExpr == null) return i
		if (evalScopeCondition(branch.conditionExpr, scope)) return i
	}
	return branches.length - 1
}

export function bindReactiveIf(options: BindReactiveIfOptions): Cleanup {
	const { anchor, scope, branches } = options
	let activeIndex = -1
	let branchCleanup: Cleanup | null = null

	const activateBranch = (index: number): void => {
		if (index === activeIndex) return
		branchCleanup?.()
		branchCleanup = null
		activeIndex = index
		const branch = branches[index]
		if (!branch) return
		anchor.innerHTML = branch.renderHtml()
		branchCleanup = branch.mountBranch(anchor)
	}

	const effect = new Effect(() => {
		activateBranch(findActiveBranchIndex(branches, scope))
	})

	return () => {
		effect.destroy()
		branchCleanup?.()
	}
}
