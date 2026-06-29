export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type SwapStyle =
	| 'innerHTML'
	| 'outerHTML'
	| 'beforebegin'
	| 'afterbegin'
	| 'beforeend'
	| 'afterend'
	| 'replace'
	| 'remove'
	| 'none'

export type RetryMode = 'auto' | 'never' | 'error'
export type CancelMode = 'auto' | 'disabled'

export interface ActionOptions {
	method?: HttpMethod
	url?: string
	target?: string
	swap?: SwapStyle
	headers?: Record<string, string>
	values?: Record<string, string>
	pushUrl?: boolean | string
	autoDisable?: boolean
	ariaBusy?: boolean
	state?: HypermediaBooleanSignal
	retry?: RetryMode
	cancel?: CancelMode
	signal?: AbortSignal
	select?: string
}

export interface HypermediaBooleanSignal {
	value: boolean
}

export interface HypermediaSignalStore {
	has?(path: string): boolean
	get(path: string): { value: unknown }
}

export interface HypermediaRequest {
	method: HttpMethod
	url: string
	headers: Record<string, string>
	body?: FormData | URLSearchParams | string
	target?: string
	swap?: SwapStyle
}

export interface HypermediaResponse {
	readonly ok: boolean
	readonly status: number
	readonly html: string
	readonly headers: Record<string, string>
}

export interface SwapOperation {
	target: Element
	html: string
	style: SwapStyle
}

export interface HypermediaSwapLifecycleOperation extends SwapOperation {
	trigger?: Element
	targetSelector: string
	performSwap(): void
	processRuntime(element: ParentNode): void
}

export type HypermediaSwapLifecycleAdapter = (
	operation: HypermediaSwapLifecycleOperation
) => void | Promise<void>
