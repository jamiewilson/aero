import { Computed } from './computed'
import { SignalStore } from './store'

export interface StateBindingSpec {
	readonly name: string
	readonly derived: boolean
	readonly initExpr: string
	readonly dependencies: readonly string[]
	readonly reactiveProp?: boolean
	readonly propName?: string
	readonly required?: boolean
	readonly bindable?: boolean
}

export interface StateScopeOptions {
	readonly store: SignalStore
	readonly bindings: readonly StateBindingSpec[]
	readonly functionSources: readonly string[]
	readonly reactiveProps?: Record<string, { value: unknown }>
	/** Module-scope values from `<script is:state>` imports, merged into eval scope. */
	readonly scopeConstants?: Record<string, unknown>
	/** External functions to inject into the eval scope (e.g. hypermedia action functions). */
	readonly actionFunctions?: Record<string, (...args: unknown[]) => unknown>
	/** Runtime-backed hypermedia actions; override imported fetch-only helpers in scope. */
	readonly hypermediaScopeActions?: Record<string, unknown>
}

export type StateScope = Record<string, unknown>

function topoSortDerived(bindings: readonly StateBindingSpec[]): StateBindingSpec[] {
	const derived = bindings.filter(b => b.derived)
	const sorted: StateBindingSpec[] = []
	const pending = new Set(derived.map(b => b.name))
	const byName = new Map(derived.map(b => [b.name, b]))

	while (pending.size > 0) {
		let progressed = false
		for (const name of [...pending]) {
			const binding = byName.get(name)!
			if (binding.dependencies.every(dep => !pending.has(dep))) {
				sorted.push(binding)
				pending.delete(name)
				progressed = true
			}
		}
		if (!progressed) {
			throw new Error('[aero] Cyclic derived state dependencies are not supported.')
		}
	}
	return sorted
}

function evalInit(initExpr: string, scope: StateScope): unknown {
	return new Function('scope', `with (scope) { return (${initExpr}); }`)(scope)
}

function defineScopeAccessor(
	scope: StateScope,
	name: string,
	read: () => unknown,
	write?: (v: unknown) => void
): void {
	Object.defineProperty(scope, name, {
		configurable: true,
		enumerable: true,
		get: read,
		...(write ? { set: write } : {}),
	})
}

function wrapFunctionSource(source: string): string {
	const match = /^function\s+(\w+)\s*\(([^)]*)\)\s*\{([\s\S]*)\}\s*$/.exec(source.trim())
	if (!match) return source
	const [, name, params, body] = match
	return `scope.${name} = function(${params}) { with (scope) { ${body} } }`
}

/**
 * Build a plain object scope backed by store signals/computeds for compiled state handlers.
 */
export function createStateScope(options: StateScopeOptions): StateScope {
	const { store, bindings, functionSources, actionFunctions, scopeConstants, hypermediaScopeActions } = options
	const reactiveProps = options.reactiveProps ?? {}
	const scope: StateScope = { ...actionFunctions, ...scopeConstants, ...hypermediaScopeActions }

	for (const binding of bindings.filter(b => !b.derived)) {
		const reactivePropKey = binding.propName ?? binding.name
		const reactiveProp = binding.reactiveProp ? reactiveProps[reactivePropKey] : undefined
		if (binding.reactiveProp && reactiveProp) {
			store.alias(binding.name, reactiveProp)
		} else if (binding.reactiveProp && binding.required) {
			throw new Error(`[aero] Required reactive prop was not provided: ${binding.name}`)
		} else if (!store.has(binding.name)) {
			store.signal(binding.name, evalInit(binding.initExpr, scope))
		}
		const write = binding.reactiveProp && !binding.bindable
			? () => {
					throw new Error(`[aero] Readonly reactive prop cannot be assigned: ${binding.name}`)
				}
			: (value: unknown) => {
					;(store.get(binding.name) as { value: unknown }).value = value
				}
		defineScopeAccessor(
			scope,
			binding.name,
			() => store.get(binding.name).value,
			write
		)
	}

	for (const binding of topoSortDerived(bindings)) {
		if (store.has(binding.name)) {
			const existing = store.get(binding.name)
			if (existing instanceof Computed) {
				defineScopeAccessor(scope, binding.name, () => existing.value)
				continue
			}
			throw new Error(
				`[aero] Derived state path ${JSON.stringify(binding.name)} already registered as signal.`
			)
		}
		store.computed(binding.name, () => evalInit(binding.initExpr, scope))
		defineScopeAccessor(scope, binding.name, () => store.get(binding.name).value)
	}

	if (functionSources.length > 0) {
		new Function('scope', functionSources.map(wrapFunctionSource).join('\n'))(scope)
	}

	return scope
}
