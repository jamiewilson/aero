import type { HypermediaRequest, HypermediaResponse } from './types'

export type LifecycleEventName = 'request' | 'response' | 'swap' | 'settle' | 'error'

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
