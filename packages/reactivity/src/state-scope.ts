import { Computed } from './computed'
import { makeReactive } from './reactive'
import { Signal } from './signal'
import { SignalStore } from './store'

export interface StateBindingSpec {
	readonly name: string
	readonly derived: boolean
	readonly initExpr?: string
	readonly init?: (scope: StateScope) => unknown
	readonly dependencies: readonly string[]
	readonly reactiveProp?: boolean
	readonly propName?: string
	readonly required?: boolean
	readonly bindable?: boolean
}

export interface StateScopeOptions {
	readonly store: SignalStore
	readonly bindings: readonly StateBindingSpec[]
	readonly functionSources?: readonly string[]
	readonly installScopeFunctions?: (scope: StateScope) => void
	/** @internal Test-only escape hatch for initExpr/functionSources strings. */
	readonly allowLegacyRuntimeCompile?: boolean
	readonly reactiveProps?: Record<string, { value: unknown }>
	/** Module-scope values from `<script is:state>` imports, merged into eval scope. */
	readonly scopeConstants?: Record<string, unknown>
	/** External functions to inject into the eval scope (e.g. hypermedia action functions). */
	readonly actionFunctions?: Record<string, (...args: unknown[]) => unknown>
	/** Runtime-backed hypermedia actions; override imported fetch-only helpers in scope. */
	readonly hypermediaScopeActions?: Record<string, unknown>
	/** Mount root element; exposed in scope as `$root` for scoped DOM queries. */
	readonly mountRoot?: ParentNode
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

function evalInit(binding: StateBindingSpec, scope: StateScope, allowLegacyRuntimeCompile: boolean): unknown {
	if (binding.init) return binding.init(scope)
	if (allowLegacyRuntimeCompile && binding.initExpr) {
		// eslint-disable-next-line @typescript-eslint/no-implied-eval
		return new Function('scope', `with (scope) { return (${binding.initExpr}); }`)(scope)
	}
	if (!binding.initExpr) {
		throw new Error(`[aero] Missing state initializer for ${binding.name}.`)
	}
	throw new Error(
		`[aero] Runtime state initialization requires compiled init functions (CSP-safe path). Binding: ${binding.name}`
	)
}

function wrapFunctionSource(source: string): string {
	const match = /^function\s+(\w+)\s*\(([^)]*)\)\s*\{([\s\S]*)\}\s*$/.exec(source.trim())
	if (!match) return source
	const [, name, params, body] = match
	return `scope.${name} = function(${params}) { with (scope) { ${body} } }`
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


/**
 * Build a plain object scope backed by store signals/computeds for compiled state handlers.
 */
export function createStateScope(options: StateScopeOptions): StateScope {
	const {
		store,
		bindings,
		functionSources,
		installScopeFunctions,
		actionFunctions,
		scopeConstants,
		hypermediaScopeActions,
		allowLegacyRuntimeCompile = false,
	} = options
	const reactiveProps = options.reactiveProps ?? {}
	const scope: StateScope = { ...actionFunctions, ...scopeConstants, ...hypermediaScopeActions }
	if (options.mountRoot) {
		Object.defineProperty(scope, '$root', {
			configurable: true,
			enumerable: true,
			value: options.mountRoot,
		})
	}

	for (const binding of bindings.filter(b => !b.derived)) {
		const reactivePropKey = binding.propName ?? binding.name
		const reactiveProp = binding.reactiveProp ? reactiveProps[reactivePropKey] : undefined
		if (binding.reactiveProp && reactiveProp) {
			store.alias(binding.name, reactiveProp)
		} else if (binding.reactiveProp && binding.required) {
			throw new Error(`[aero] Required reactive prop was not provided: ${binding.name}`)
		} else if (!store.has(binding.name)) {
			const initial = evalInit(binding, scope, allowLegacyRuntimeCompile)
			const signal = store.signal(binding.name)
			signal.value = makeReactive(initial, () => (store.get(binding.name) as Signal<unknown>).notify())
		} else {
			const signal = store.get(binding.name) as Signal<unknown>
			if (!(signal instanceof Computed)) {
				const current = signal.value
				const wrapped = makeReactive(current, () => signal.notify())
				if (!Object.is(current, wrapped)) {
					signal.value = wrapped
				}
			}
		}
		const notifyBinding = (): void => {
			;(store.get(binding.name) as Signal<unknown>).notify()
		}
		const write = binding.reactiveProp && !binding.bindable
			? () => {
					throw new Error(`[aero] Readonly reactive prop cannot be assigned: ${binding.name}`)
				}
			: (value: unknown) => {
					;(store.get(binding.name) as Signal<unknown>).value = makeReactive(value, notifyBinding)
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
		store.computed(binding.name, () => evalInit(binding, scope, allowLegacyRuntimeCompile))
		defineScopeAccessor(scope, binding.name, () => store.get(binding.name).value)
	}

	if (installScopeFunctions) {
		installScopeFunctions(scope)
	} else if (functionSources && functionSources.length > 0) {
		if (allowLegacyRuntimeCompile) {
			// eslint-disable-next-line @typescript-eslint/no-implied-eval
			new Function('scope', functionSources.map(wrapFunctionSource).join('\n'))(scope)
		} else {
			throw new Error(
				'[aero] Runtime function installation requires compiled scope installers (CSP-safe path).'
			)
		}
	}

	return scope
}
