import { Effect } from '../effect'
import type { Cleanup } from '../mount'
import { evalScopeCondition } from '../scope-eval'
import type { StateScope } from '../state-scope'
import {
	type MountTarget,
	setMountTargetHtml,
	clearMountTarget,
} from './anchor'

export interface ReactiveIfBranchSpec {
	readonly conditionExpr?: string | null
	readonly condition?: (scope: StateScope) => boolean
	readonly renderHtml: () => string
	readonly mountBranch: (branchRoot: ParentNode) => Cleanup
}

export interface BindReactiveIfOptions {
	readonly mountTarget: MountTarget
	readonly scope: StateScope
	readonly branches: readonly ReactiveIfBranchSpec[]
}

function findActiveBranchIndex(
	branches: readonly ReactiveIfBranchSpec[],
	scope: StateScope
): number {
	for (let i = 0; i < branches.length; i++) {
		const branch = branches[i]!
		if (branch.condition == null && branch.conditionExpr == null) return i
		if (branch.condition) {
			if (branch.condition(scope)) return i
			continue
		}
		if (branch.conditionExpr != null && evalScopeCondition(branch.conditionExpr, scope)) return i
	}
	return branches.length - 1
}

export function bindReactiveIf(options: BindReactiveIfOptions): Cleanup {
	const { mountTarget, scope, branches } = options
	let activeIndex = -1
	let branchCleanup: Cleanup | null = null

	const activateBranch = (index: number): void => {
		if (index === activeIndex) return
		branchCleanup?.()
		branchCleanup = null
		activeIndex = index
		const branch = branches[index]
		if (!branch) return
		const branchRoot = setMountTargetHtml(mountTarget, branch.renderHtml())
		branchCleanup = branch.mountBranch(branchRoot)
	}

	const effect = new Effect(() => {
		const idx = findActiveBranchIndex(branches, scope)
		if (idx < 0 || !branches[idx]) {
			branchCleanup?.()
			branchCleanup = null
			activeIndex = -1
			clearMountTarget(mountTarget)
			return
		}
		activateBranch(idx)
	})

	return () => {
		effect.destroy()
		branchCleanup?.()
	}
}
