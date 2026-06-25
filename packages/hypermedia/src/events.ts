import type { HypermediaRequest, HypermediaResponse } from './types'

export type LifecycleEventName = 'aero:request' | 'aero:response' | 'aero:swap' | 'aero:settle' | 'aero:error'

export interface LifecycleEvent extends CustomEvent<LifecycleDetail> {
	readonly type: LifecycleEventName
}

export interface LifecycleDetail {
	request: HypermediaRequest
	response?: HypermediaResponse
	swapStyle?: string
	target?: string
	error?: Error
	trigger?: Element
}

export function dispatchLifecycleEvent(name: LifecycleEventName, detail: LifecycleDetail, element?: Element): void {
	const event = new CustomEvent(name, {
		bubbles: true,
		cancelable: true,
		detail,
	})
	const target = element ?? document
	target.dispatchEvent(event)
}
