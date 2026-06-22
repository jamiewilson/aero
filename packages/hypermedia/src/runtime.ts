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
	registerBusyBinding(element: Element, signalName: string, setBusy: (value: boolean) => void): void
}

export interface HypermediaRuntimeOptions {
	readonly debug?: boolean
	readonly defaultSwap?: SwapStyle
	readonly defaultTarget?: string
}

function resolveSwapTarget(
	effectiveTarget: string | undefined,
	trigger: Element | undefined,
	context: ParentNode
): Element | null {
	if (effectiveTarget) {
		return resolveTarget(effectiveTarget, context)
	}
	if (trigger) return trigger
	return null
}

function applyPushUrl(
	response: HypermediaResponse,
	opts: ActionOptions,
	trigger?: Element
): void {
	const headerPush = response.headers['aero-push-url']
	if (headerPush) {
		history.pushState({}, '', headerPush)
		return
	}
	if (opts.pushUrl === false) return
	if (typeof opts.pushUrl === 'string') {
		history.pushState({}, '', opts.pushUrl)
		return
	}
	if (opts.pushUrl === true && trigger instanceof HTMLAnchorElement && trigger.href) {
		history.pushState({}, '', trigger.href)
	}
}

function syncNativeFallback(trigger: Element | undefined, url: string): void {
	if (!trigger || !url) return
	if (trigger instanceof HTMLAnchorElement) {
		trigger.href = url
	}
	if (trigger instanceof HTMLFormElement) {
		trigger.action = url
	}
}

export function createHypermediaRuntime(options: HypermediaRuntimeOptions = {}): HypermediaRuntime {
	const defaultSwap = options.defaultSwap ?? 'innerHTML'
	const defaultTarget = options.defaultTarget
	const busyBindings = new Map<Element, { signalName: string; setBusy: (value: boolean) => void }>()
	const inFlightCounts = new Map<Element, number>()

	function emit(name: LifecycleEventName, detail: LifecycleDetail, element?: Element): void {
		dispatchLifecycleEvent(name, detail, element)
	}

	function setBusyForElement(element: Element | undefined, busy: boolean): void {
		if (!element) return
		const binding = busyBindings.get(element)
		if (!binding) return
		const count = (inFlightCounts.get(element) ?? 0) + (busy ? 1 : -1)
		const next = Math.max(0, count)
		if (next === 0) inFlightCounts.delete(element)
		else inFlightCounts.set(element, next)
		binding.setBusy(next > 0)
	}

	async function executeAction(actionOptions: ActionOptions, trigger?: Element): Promise<HypermediaResponse> {
		const opts: ActionOptions = {
			swap: actionOptions.swap ?? defaultSwap,
			target: actionOptions.target ?? defaultTarget,
			...actionOptions,
		}

		const request = buildRequest(opts, trigger)
		syncNativeFallback(trigger, request.url)
		emit('request', { request, trigger }, trigger)
		setBusyForElement(trigger, true)

		let response: HypermediaResponse
		try {
			response = await executeRequest(request)
		} catch (error) {
			setBusyForElement(trigger, false)
			emit('error', { request, error: error instanceof Error ? error : new Error(String(error)), trigger }, trigger)
			throw error
		}

		emit('response', { request, response, trigger }, trigger)

		const headerSwap = response.headers['aero-swap']
		const headerTarget = response.headers['aero-target']
		const effectiveSwap = parseSwapStyle(headerSwap ?? '') ?? opts.swap ?? defaultSwap
		const effectiveTarget = headerTarget ?? opts.target
		const context = trigger?.ownerDocument ?? document
		const targetEl = resolveSwapTarget(effectiveTarget, trigger, context)

		if (targetEl && effectiveSwap !== 'none') {
			emit('swap', { request, response, swapStyle: effectiveSwap, target: effectiveTarget ?? 'self', trigger }, trigger)
			performSwap({ target: targetEl, html: response.html, style: effectiveSwap })
			adoptFragment(targetEl, runtime)
			emit('settle', { request, response, target: effectiveTarget ?? 'self', trigger }, trigger)
			if (targetEl !== trigger) {
				emit('settle', { request, response, target: effectiveTarget ?? 'self', trigger }, targetEl)
			}
		}

		applyPushUrl(response, opts, trigger)
		setBusyForElement(trigger, false)

		return response
	}

	function swapElement(targetSelector: string, html: string, style: SwapStyle, context?: ParentNode): void {
		const ctx = context ?? document
		const targetEl = resolveTarget(targetSelector, ctx)
		if (!targetEl) {
			throw new Error(`[aero] Swap target not found: ${targetSelector}`)
		}
		performSwap({ target: targetEl, html, style })
		adoptFragment(targetEl, runtime)
	}

	const runtime: HypermediaRuntime = {
		kind: 'hypermedia-runtime',
		debug: options.debug,
		executeAction,
		swapElement,
		adopt: () => {},
		registerBusyBinding(element, signalName, setBusy) {
			busyBindings.set(element, { signalName, setBusy })
		},
	}
	runtime.adopt = (container: ParentNode) => adoptFragment(container, runtime)
	return runtime
}
