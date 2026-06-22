import type { ActionOptions, HypermediaRequest, HypermediaResponse, SwapStyle } from './types'
import { buildRequest, executeRequest } from './request'
import { resolveTarget, performSwap, parseSwapStyle } from './swap'
import { dispatchLifecycleEvent, type LifecycleEventName, type LifecycleDetail } from './events'
import { adopt as adoptFragment } from './adopt'

export interface HypermediaRuntime {
	readonly kind: 'hypermedia-runtime'
	readonly debug?: boolean
	executeAction(options: ActionOptions, trigger?: Element): Promise<HypermediaResponse>
	swapElement(targetSelector: string, html: string, style: SwapStyle, context?: ParentNode): void
	adopt(container: ParentNode): void
}

export interface HypermediaRuntimeOptions {
	readonly debug?: boolean
	readonly defaultSwap?: SwapStyle
	readonly defaultTarget?: string
}

export function createHypermediaRuntime(options: HypermediaRuntimeOptions = {}): HypermediaRuntime {
	const defaultSwap = options.defaultSwap ?? 'innerHTML'
	const defaultTarget = options.defaultTarget

	function emit(name: LifecycleEventName, detail: LifecycleDetail, element?: Element): void {
		dispatchLifecycleEvent(name, detail, element)
	}

	async function executeAction(actionOptions: ActionOptions, trigger?: Element): Promise<HypermediaResponse> {
		const opts: ActionOptions = {
			swap: actionOptions.swap ?? defaultSwap,
			target: actionOptions.target ?? defaultTarget,
			...actionOptions,
		}

		const request = buildRequest(opts, trigger)
		emit('request', { request, trigger }, trigger)

		let response: HypermediaResponse
		try {
			response = await executeRequest(request)
		} catch (error) {
			emit('error', { request, error: error instanceof Error ? error : new Error(String(error)), trigger }, trigger)
			throw error
		}

		emit('response', { request, response, trigger }, trigger)

		const headerSwap = response.headers['aero-swap']
		const headerTarget = response.headers['aero-target']
		const effectiveSwap = parseSwapStyle(headerSwap ?? '') ?? opts.swap ?? defaultSwap
		const effectiveTarget = headerTarget ?? opts.target

		if (effectiveTarget && trigger) {
			const context = trigger.ownerDocument ?? document
			const targetEl = resolveTarget(effectiveTarget, context)
			if (targetEl) {
				emit('swap', { request, response, swapStyle: effectiveSwap, target: effectiveTarget, trigger }, trigger)
				performSwap({ target: targetEl, html: response.html, style: effectiveSwap })
				emit('settle', { request, response, target: effectiveTarget, trigger }, trigger)
			}
		}

		return response
	}

	function swapElement(targetSelector: string, html: string, style: SwapStyle, context?: ParentNode): void {
		const ctx = context ?? document
		const targetEl = resolveTarget(targetSelector, ctx)
		if (!targetEl) {
			throw new Error(`[aero] Swap target not found: ${targetSelector}`)
		}
		performSwap({ target: targetEl, html, style })
	}

	const runtime: HypermediaRuntime = {
		kind: 'hypermedia-runtime',
		debug: options.debug,
		executeAction,
		swapElement,
		adopt: () => {},
	}
	runtime.adopt = (container: ParentNode) => adoptFragment(container, runtime)
	return runtime
}
