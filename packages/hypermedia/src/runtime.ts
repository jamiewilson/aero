import type {
	ActionOptions,
	HypermediaBooleanSignal,
	HypermediaRequest,
	HypermediaResponse,
	HypermediaSignalStore,
	HypermediaSwapLifecycleAdapter,
	SwapStyle,
} from './types'
import { buildRequest, executeRequest } from './request'
import { resolveTarget, performSwap, parseSwapStyle } from './swap'
import { dispatchLifecycleEvent, type LifecycleEventName, type LifecycleDetail } from './events'
import { adopt as adoptFragment } from './adopt'

export interface HypermediaRuntime {
	readonly kind: 'hypermedia-runtime'
	readonly debug?: boolean
	executeAction(options: ActionOptions, trigger?: Element): Promise<HypermediaResponse>
	swapElement(targetSelector: string, html: string, style: SwapStyle, context?: ParentNode): void
	adopt(container: ParentNode, store?: HypermediaSignalStore): void
	registerBusyBinding(element: Element, signalName: string, signal: HypermediaBooleanSignal): () => void
	setSwapLifecycleAdapter(adapter: HypermediaSwapLifecycleAdapter | null): void
}

export interface HypermediaRuntimeOptions {
	readonly debug?: boolean
	readonly defaultSwap?: SwapStyle
	readonly defaultTarget?: string
	readonly swapLifecycleAdapter?: HypermediaSwapLifecycleAdapter
	readonly store?: HypermediaSignalStore
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

function resolveExplicitTarget(targetSelector: string | undefined, context: ParentNode): Element | undefined {
	if (!targetSelector) return undefined
	return resolveTarget(targetSelector, context) ?? undefined
}

export function createHypermediaRuntime(options: HypermediaRuntimeOptions = {}): HypermediaRuntime {
	const defaultSwap = options.defaultSwap ?? 'innerHTML'
	const defaultTarget = options.defaultTarget
	const busyBindings = new Map<Element, { signalName: string; signal: HypermediaBooleanSignal }>()
	const inFlightCounts = new WeakMap<HypermediaBooleanSignal, number>()
	let defaultStore = options.store
	let swapLifecycleAdapter = options.swapLifecycleAdapter ?? null

	function emit(name: LifecycleEventName, detail: LifecycleDetail, element?: Element): void {
		dispatchLifecycleEvent(name, detail, element)
	}

	function emitLifecycle(
		name: LifecycleEventName,
		detail: LifecycleDetail,
		trigger: Element | undefined,
		target: Element | undefined
	): void {
		emit(name, detail, trigger)
		if (target && target !== trigger) {
			emit(name, detail, target)
		}
	}

	function setBusyForSignal(signal: HypermediaBooleanSignal | undefined, busy: boolean): void {
		if (!signal) return
		const count = (inFlightCounts.get(signal) ?? 0) + (busy ? 1 : -1)
		const next = Math.max(0, count)
		if (next === 0) inFlightCounts.delete(signal)
		else inFlightCounts.set(signal, next)
		signal.value = next > 0
	}

	function resolveBusySignal(opts: ActionOptions, trigger: Element | undefined): HypermediaBooleanSignal | undefined {
		if (opts.state) {
			if (typeof opts.state.value !== 'boolean') {
				throw new Error('[aero] Hypermedia state signal must be boolean.')
			}
			return opts.state
		}
		if (!trigger) return undefined
		return busyBindings.get(trigger)?.signal
	}

	function shouldAutoDisable(method: string, opts: ActionOptions): boolean {
		if (opts.autoDisable === false) return false
		return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
	}

	function setDisabled(trigger: Element | undefined, disabled: boolean): void {
		if (!trigger || !('disabled' in trigger)) return
		;(trigger as { disabled: boolean }).disabled = disabled
	}

	async function runSwapLifecycle(options: {
		target: Element
		html: string
		style: SwapStyle
		trigger?: Element
		targetSelector: string
	}): Promise<void> {
		const operation = {
			target: options.target,
			html: options.html,
			style: options.style,
			trigger: options.trigger,
			targetSelector: options.targetSelector,
			performSwap() {
				performSwap({ target: options.target, html: options.html, style: options.style })
			},
			adoptRuntime(container: ParentNode) {
				runtime.adopt(container)
			},
		}

		if (swapLifecycleAdapter) {
			await swapLifecycleAdapter(operation)
			return
		}

		operation.performSwap()
		operation.adoptRuntime(options.target)
	}

	async function executeAction(actionOptions: ActionOptions, trigger?: Element): Promise<HypermediaResponse> {
		const opts: ActionOptions = {
			swap: actionOptions.swap ?? defaultSwap,
			target: actionOptions.target ?? defaultTarget,
			...actionOptions,
		}

		const request = buildRequest(opts, trigger)
		const busySignal = resolveBusySignal(opts, trigger)
		const autoDisable = shouldAutoDisable(request.method, opts)
		const previousDisabled = trigger && 'disabled' in trigger ? Boolean((trigger as { disabled: boolean }).disabled) : undefined
		syncNativeFallback(trigger, request.url)
		const context = trigger?.ownerDocument ?? document
		const requestTargetSelector = opts.target ?? defaultTarget
		const requestTarget = resolveExplicitTarget(requestTargetSelector, context)
		emitLifecycle(
			'request',
			{ request, target: requestTargetSelector, trigger },
			trigger,
			requestTarget
		)
		setBusyForSignal(busySignal, true)
		if (autoDisable) setDisabled(trigger, true)

		let response: HypermediaResponse
		try {
			try {
				response = await executeRequest(request)
			} catch (error) {
				emitLifecycle(
					'error',
					{
						request,
						error: error instanceof Error ? error : new Error(String(error)),
						target: requestTargetSelector,
						trigger,
					},
					trigger,
					requestTarget
				)
				throw error
			}

			const headerSwap = response.headers['aero-swap']
			const headerTarget = response.headers['aero-target']
			const effectiveSwap = parseSwapStyle(headerSwap ?? '') ?? opts.swap ?? defaultSwap
			const effectiveTarget = headerTarget ?? opts.target
			const targetEl = resolveSwapTarget(effectiveTarget, trigger, context)
			const explicitTargetEl = effectiveTarget ? (targetEl ?? undefined) : undefined
			const lifecycleTarget = effectiveTarget ?? 'self'

			emitLifecycle(
				'response',
				{ request, response, target: lifecycleTarget, trigger },
				trigger,
				explicitTargetEl
			)

			if (targetEl && effectiveSwap !== 'none') {
				await runSwapLifecycle({
					target: targetEl,
					html: response.html,
					style: effectiveSwap,
					trigger,
					targetSelector: lifecycleTarget,
				})
				emitLifecycle(
					'swap',
					{ request, response, swapStyle: effectiveSwap, target: lifecycleTarget, trigger },
					trigger,
					explicitTargetEl
				)
				emitLifecycle(
					'settle',
					{ request, response, target: lifecycleTarget, trigger },
					trigger,
					explicitTargetEl
				)
			}

			applyPushUrl(response, opts, trigger)

			return response
		} finally {
			setBusyForSignal(busySignal, false)
			if (autoDisable && previousDisabled !== undefined) setDisabled(trigger, previousDisabled)
		}
	}

	function swapElement(targetSelector: string, html: string, style: SwapStyle, context?: ParentNode): void {
		const ctx = context ?? document
		const targetEl = resolveTarget(targetSelector, ctx)
		if (!targetEl) {
			throw new Error(`[aero] Swap target not found: ${targetSelector}`)
		}
		void runSwapLifecycle({ target: targetEl, html, style, targetSelector })
	}

	const runtime: HypermediaRuntime = {
		kind: 'hypermedia-runtime',
		debug: options.debug,
		executeAction,
		swapElement,
		adopt: () => {},
		registerBusyBinding(element, signalName, signal) {
			if (typeof signal.value !== 'boolean') {
				throw new Error(`[aero] Hypermedia busy signal must be boolean: ${signalName}`)
			}
			busyBindings.set(element, { signalName, signal })
			return () => {
				if (busyBindings.get(element)?.signalName === signalName) {
					busyBindings.delete(element)
				}
			}
		},
		setSwapLifecycleAdapter(adapter) {
			swapLifecycleAdapter = adapter
		},
	}
	runtime.adopt = (container: ParentNode, store?: HypermediaSignalStore) => {
		if (store) defaultStore = store
		adoptFragment(container, runtime, store ?? defaultStore)
	}
	return runtime
}
