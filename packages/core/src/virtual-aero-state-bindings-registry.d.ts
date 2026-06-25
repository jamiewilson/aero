declare module 'virtual:aero/state-bindings-registry.ts' {
	import type { StateBindingsMountFn } from './runtime/state-bindings-prod'

	export function resolveStateBindingsModule(
		pathname: string
	): Promise<StateBindingsMountFn | null>
}
