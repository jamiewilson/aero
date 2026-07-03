import type {
	ActionOptions,
	HypermediaBooleanSignal,
	HypermediaRequest,
	HypermediaResponse,
	HypermediaSignalStore,
	HypermediaSwapLifecycleAdapter,
	SwapStyle,
} from './types'
import { buildRequest, executeRequestWithRetry, normalizeMethod, openHypermediaRequest } from './request'
import { resolveTarget, performSwap, parseSwapStyle, resolveSwapProcessContainer } from './swap'
import { dispatchLifecycleEvent, type LifecycleEventName, type LifecycleDetail } from './events'
import { process as processFragment } from './process'
import { parseOobSwaps } from './oob'
import { isFullPageRegionTarget, mergeHeadFromHtml } from './head-merge'
import { syncMethodOverride } from './method-override'
import { applySelectFilter, isAbortError } from './request-policy'
import { applySignalPatch, isJsonContentType, parseSignalPatch } from './signal-patch'
import {
	type SseElementPatch,
	handleSseMessage,
	isEventStreamContentType,
	readSseStream,
	runSseSession,
} from './sse'

type LifecyclePhase = 'loading' | 'swapping' | 'settling'

const PHASE_CLASS: Record<LifecyclePhase, string> = {
	loading: 'aero-loading',
	swapping: 'aero-swapping',
	settling: 'aero-settling',
}

export interface HypermediaRuntime {
	readonly kind: 'hypermedia-runtime'
	readonly debug?: boolean
	executeAction(options: ActionOptions, trigger?: Element): Promise<HypermediaResponse>
	swapElement(targetSelector: string, html: string, style: SwapStyle, context?: ParentNode): void
	process(element: ParentNode, store?: HypermediaSignalStore): void
	registerBusyBinding(element: Element, signalName: string, signal: HypermediaBooleanSignal): () => void
	setSwapLifecycleAdapter(adapter: HypermediaSwapLifecycleAdapter | null): void
}

export interface HypermediaRuntimeOptions {
	readonly debug?: boolean
	readonly reactivity?: boolean
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
	trigger?: Element,
	requestMethod?: string
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
	const shouldDefaultPush =
		opts.pushUrl === true ||
		(opts.pushUrl === undefined &&
			trigger instanceof HTMLAnchorElement &&
			(requestMethod ?? 'GET').toUpperCase() === 'GET')
	if (shouldDefaultPush && trigger instanceof HTMLAnchorElement && trigger.href) {
		history.pushState({}, '', trigger.href)
	}
}

function syncNativeFallback(trigger: Element | undefined, url: string, method: string): void {
	if (!trigger || !url) return
	if (trigger instanceof HTMLAnchorElement) {
		trigger.href = url
	}
	if (trigger instanceof HTMLFormElement) {
		trigger.action = url
		syncMethodOverride(trigger, normalizeMethod(method))
	}
}

function resolveExplicitTarget(targetSelector: string | undefined, context: ParentNode): Element | undefined {
	if (!targetSelector) return undefined
	return resolveTarget(targetSelector, context) ?? undefined
}

function uniqueElements(...elements: Array<Element | undefined>): Element[] {
	const result: Element[] = []
	for (const element of elements) {
		if (!element || result.includes(element)) continue
		result.push(element)
	}
	return result
}

function setPhaseClass(elements: readonly Element[], phase: LifecyclePhase | null): void {
	for (const element of elements) {
		for (const className of Object.values(PHASE_CLASS)) {
			element.classList.remove(className)
		}
		if (phase) {
			element.classList.add(PHASE_CLASS[phase])
		}
	}
}

function createAriaBusyMirror(enabled: boolean): {
	add(elements: readonly Element[]): void
	restore(): void
} {
	const previous = new Map<Element, string | null>()

	return {
		add(elements) {
			if (!enabled) return
			for (const element of elements) {
				if (!previous.has(element)) {
					previous.set(element, element.getAttribute('aria-busy'))
				}
				element.setAttribute('aria-busy', 'true')
			}
		},
		restore() {
			for (const [element, value] of previous) {
				if (value === null) {
					element.removeAttribute('aria-busy')
				} else {
					element.setAttribute('aria-busy', value)
				}
			}
			previous.clear()
		},
	}
}

const SUPERSEDED_ABORT = Symbol('aero-hypermedia-superseded')

function isSupersededAbort(signal: AbortSignal | undefined): boolean {
	return Boolean(signal?.aborted && signal.reason === SUPERSEDED_ABORT)
}

function createSupersededResponse(): HypermediaResponse {
	return { ok: false, status: 0, html: '', headers: {} }
}

function createRequestAbortControl(
	trigger: Element | undefined,
	opts: ActionOptions,
	triggerCancelControllers: Map<Element, AbortController>,
	triggerGeneration: Map<Element, number>
): { signal?: AbortSignal; isLatest: () => boolean } {
	let generation = 0
	if (trigger) {
		generation = (triggerGeneration.get(trigger) ?? 0) + 1
		triggerGeneration.set(trigger, generation)
	}

	const cancel = opts.cancel ?? 'auto'
	let requestController: AbortController | undefined

	if (cancel !== 'disabled' && trigger) {
		const previous = triggerCancelControllers.get(trigger)
		if (previous && !previous.signal.aborted) {
			previous.abort(SUPERSEDED_ABORT)
		}
		requestController = new AbortController()
		triggerCancelControllers.set(trigger, requestController)
	}

	if (opts.signal) {
		const external = opts.signal
		if (requestController) {
			if (external.aborted) requestController.abort(external.reason)
			else {
				external.addEventListener('abort', () => requestController!.abort(external.reason), {
					once: true,
				})
			}
		} else {
			requestController = new AbortController()
			if (external.aborted) requestController.abort(external.reason)
			else {
				external.addEventListener('abort', () => requestController!.abort(external.reason), {
					once: true,
				})
			}
		}
	}

	return {
		signal: requestController?.signal,
		isLatest: () => !trigger || triggerGeneration.get(trigger) === generation,
	}
}

let popstateReloadRegistered = false

function registerPopstateReload(): void {
	if (popstateReloadRegistered || typeof window === 'undefined') return
	popstateReloadRegistered = true
	window.addEventListener('popstate', () => {
		location.assign(location.href)
	})
}

function createFocusFallback(target: Element): () => void {
	const doc = target.ownerDocument
	const activeBeforeSwap = doc.activeElement
	const shouldFallback =
		activeBeforeSwap instanceof Element && target.contains(activeBeforeSwap)

	return () => {
		if (!shouldFallback || activeBeforeSwap?.isConnected || !target.isConnected) return
		if (!(target instanceof HTMLElement)) return

		if (!target.hasAttribute('tabindex')) {
			target.setAttribute('tabindex', '-1')
		}

		try {
			target.focus({ preventScroll: true })
		} catch {
			target.focus()
		}
	}
}

export function createHypermediaRuntime(options: HypermediaRuntimeOptions = {}): HypermediaRuntime {
	registerPopstateReload()
	const reactivityEnabled = options.reactivity === true
	const defaultSwap = options.defaultSwap ?? 'innerHTML'
	const defaultTarget = options.defaultTarget
	const busyBindings = new Map<Element, { signalName: string; signal: HypermediaBooleanSignal }>()
	const inFlightCounts = new WeakMap<HypermediaBooleanSignal, number>()
	const triggerCancelControllers = new Map<Element, AbortController>()
	const triggerGeneration = new Map<Element, number>()
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
		if (opts.autoDisable === true) return true
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
		let insertedRoots: readonly Element[] = []
		const operation = {
			target: options.target,
			html: options.html,
			style: options.style,
			trigger: options.trigger,
			targetSelector: options.targetSelector,
			get insertedRoots() {
				return insertedRoots
			},
			performSwap() {
				const applyFocusFallback = createFocusFallback(options.target)
				insertedRoots = performSwap({ target: options.target, html: options.html, style: options.style })
				applyFocusFallback()
			},
			processRuntime(element: ParentNode) {
				runtime.process(element)
			},
		}

		if (swapLifecycleAdapter) {
			await swapLifecycleAdapter(operation)
			return
		}

		operation.performSwap()
		operation.processRuntime(
			resolveSwapProcessContainer(
				options.target,
				options.style,
				options.targetSelector,
				options.target.ownerDocument ?? document,
				insertedRoots
			)
		)
	}

	async function applySseElementPatches(
		patches: readonly SseElementPatch[],
		trigger: Element | undefined,
		context: Document
	): Promise<void> {
		for (const patch of patches) {
			const style = parseSwapStyle(patch.swap ?? '') ?? defaultSwap
			const targetEl = resolveTarget(patch.target, context)
			if (!targetEl) continue

			const { primaryHtml, oobSwaps } = parseOobSwaps(patch.html)
			const selectedHtml = applySelectFilter(primaryHtml, patch.select)
			if (selectedHtml === null) continue

			await runSwapLifecycle({
				target: targetEl,
				html: selectedHtml,
				style,
				trigger,
				targetSelector: patch.target,
			})

			for (const oob of oobSwaps) {
				const oobTarget = context.getElementById(oob.id)
				if (!oobTarget) continue
				await runSwapLifecycle({
					target: oobTarget,
					html: oob.html,
					style: oob.style,
					trigger,
					targetSelector: `#${oob.id}`,
				})
			}
		}
	}

	async function consumeSseResponse(
		response: HypermediaResponse,
		options: {
			request: HypermediaRequest
			trigger?: Element
			context: Document
			abortSignal?: AbortSignal
			openWhenHidden: boolean
		}
	): Promise<void> {
		const handlers = {
			onElementsPatch: (patches: readonly SseElementPatch[]) =>
				applySseElementPatches(patches, options.trigger, options.context),
			onSignalsPatch: (patch: Record<string, unknown>) => {
				if (reactivityEnabled) applySignalPatch(defaultStore, patch)
			},
		}

		if (response.stream) {
			const result = await readSseStream(
				response.stream,
				(event, data) => handleSseMessage(event, data, handlers, reactivityEnabled),
				options.abortSignal
			)
			if (result !== 'error' || options.abortSignal?.aborted) return
		}

		await runSseSession({
			open: () => openHypermediaRequest(options.request, options.abortSignal),
			signal: options.abortSignal,
			openWhenHidden: options.openWhenHidden,
			reactivity: reactivityEnabled,
			handlers,
		})
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
		syncNativeFallback(trigger, request.url, request.method)
		const context = trigger?.ownerDocument ?? document
		const requestTargetSelector = opts.target ?? defaultTarget
		const requestTarget = resolveExplicitTarget(requestTargetSelector, context)
		const ariaBusy = createAriaBusyMirror(opts.ariaBusy === true)
		const phasedElements = new Set<Element>()
		const setLifecyclePhase = (elements: readonly Element[], phase: LifecyclePhase | null) => {
			for (const element of elements) phasedElements.add(element)
			setPhaseClass([...phasedElements], null)
			setPhaseClass(elements, phase)
			ariaBusy.add(elements)
		}
		const requestElements = uniqueElements(trigger, requestTarget)
		setLifecyclePhase(requestElements, 'loading')
		emitLifecycle(
			'request',
			{ request, target: requestTargetSelector, trigger },
			trigger,
			requestTarget
		)
		setBusyForSignal(busySignal, true)
		if (autoDisable) setDisabled(trigger, true)

		const { signal: abortSignal, isLatest } = createRequestAbortControl(
			trigger,
			opts,
			triggerCancelControllers,
			triggerGeneration
		)

		let response: HypermediaResponse
		try {
			try {
				response = await executeRequestWithRetry(request, {
					retry: opts.retry ?? 'auto',
					signal: abortSignal,
				})
			} catch (error) {
				if (isSupersededAbort(abortSignal)) {
					return createSupersededResponse()
				}
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

			if (!isLatest()) {
				return response
			}

			if (isJsonContentType(response.headers['content-type'])) {
				if (reactivityEnabled) {
					const patch = parseSignalPatch(response.html)
					if (patch) applySignalPatch(defaultStore, patch)
				}
				return response
			}

			if (isEventStreamContentType(response.headers['content-type'])) {
				setPhaseClass([...phasedElements], null)
				emitLifecycle(
					'response',
					{ request, response, target: requestTargetSelector ?? 'sse', trigger },
					trigger,
					requestTarget
				)
				await consumeSseResponse(response, {
					request,
					trigger,
					context,
					abortSignal,
					openWhenHidden: opts.openWhenHidden ?? true,
				})
				return response
			}

			const headerSwap = response.headers['aero-swap']
			const headerTarget = response.headers['aero-target']
			const effectiveSwap = parseSwapStyle(headerSwap ?? '') ?? opts.swap ?? defaultSwap
			const effectiveTarget = headerTarget ?? opts.target
			const targetEl = resolveSwapTarget(effectiveTarget, trigger, context)
			const explicitTargetEl = effectiveTarget ? (targetEl ?? undefined) : undefined
			const lifecycleTarget = effectiveTarget ?? 'self'
			const effectiveElements = uniqueElements(trigger, explicitTargetEl)

			setPhaseClass([...phasedElements], null)
			emitLifecycle(
				'response',
				{ request, response, target: lifecycleTarget, trigger },
				trigger,
				explicitTargetEl
			)

			const { primaryHtml, oobSwaps } = parseOobSwaps(response.html)
			const selectedHtml = applySelectFilter(primaryHtml, opts.select)

			if (targetEl && effectiveSwap !== 'none' && selectedHtml !== null) {
				setLifecyclePhase(effectiveElements, 'swapping')
				await runSwapLifecycle({
					target: targetEl,
					html: selectedHtml,
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
				setLifecyclePhase(effectiveElements, 'settling')
				emitLifecycle(
					'settle',
					{ request, response, target: lifecycleTarget, trigger },
					trigger,
					explicitTargetEl
				)
				setPhaseClass([...phasedElements], null)

				if (isFullPageRegionTarget(lifecycleTarget)) {
					mergeHeadFromHtml(response.html)
				}
			}

			for (const oob of oobSwaps) {
				const oobTarget = context.getElementById(oob.id)
				if (!oobTarget) continue
				const oobSelector = `#${oob.id}`
				const oobElements = uniqueElements(trigger, oobTarget)
				setLifecyclePhase(oobElements, 'swapping')
				await runSwapLifecycle({
					target: oobTarget,
					html: oob.html,
					style: oob.style,
					trigger,
					targetSelector: oobSelector,
				})
				emitLifecycle(
					'swap',
					{ request, response, swapStyle: oob.style, target: oobSelector, trigger },
					trigger,
					oobTarget
				)
				setLifecyclePhase(oobElements, 'settling')
				emitLifecycle(
					'settle',
					{ request, response, target: oobSelector, trigger },
					trigger,
					oobTarget
				)
				setPhaseClass([...phasedElements], null)
			}

			applyPushUrl(response, opts, trigger, request.method)

			return response
		} finally {
			setPhaseClass([...phasedElements], null)
			ariaBusy.restore()
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
		process: () => {},
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
		setSwapLifecycleAdapter(adapter: HypermediaSwapLifecycleAdapter | null) {
			swapLifecycleAdapter = adapter
		},
	}
	runtime.process = (element: ParentNode, store?: HypermediaSignalStore) => {
		if (store) defaultStore = store
		processFragment(element, runtime, store ?? defaultStore)
	}
	return runtime
}
