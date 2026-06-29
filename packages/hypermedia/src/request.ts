import type { ActionOptions, HttpMethod, HypermediaRequest, HypermediaResponse } from './types'
import { syncMethodOverride } from './method-override'

export function normalizeMethod(method: string): HttpMethod {
	const upper = method.toUpperCase()
	if (upper === 'GET' || upper === 'POST' || upper === 'PUT' || upper === 'PATCH' || upper === 'DELETE') {
		return upper
	}
	return 'GET'
}

export function buildRequest(options: ActionOptions, trigger?: Element): HypermediaRequest {
	const method = normalizeMethod(options.method ?? 'GET')
	const url = options.url ?? ''
	const headers: Record<string, string> = { ...options.headers }
	syncMethodOverride(trigger, method)
	if (trigger && trigger instanceof HTMLFormElement && method !== 'GET') {
		const form = trigger as HTMLFormElement
		const formData = new FormData(form)
		const entries: Record<string, string> = {}
		for (const [key, value] of formData) {
			entries[key] = String(value)
		}
		const body = new URLSearchParams(entries)
		return { method, url: options.url ?? form.action, headers, body, target: options.target, swap: options.swap }
	}
	if (trigger) {
		const attrAction = trigger.getAttribute('data-aero-action')
		if (attrAction) urlCheck(attrAction)
	}
	return { method, url, headers, target: options.target, swap: options.swap }
}

function buildFetchOptions(request: HypermediaRequest, signal?: AbortSignal): RequestInit {
	const init: RequestInit = { method: request.method, headers: { ...request.headers } }
	if (request.body) init.body = request.body
	if (signal) init.signal = signal
	return init
}

export async function executeRequest(request: HypermediaRequest, options?: { signal?: AbortSignal }): Promise<HypermediaResponse> {
	const response = await fetch(request.url, buildFetchOptions(request, options?.signal))
	const headers: Record<string, string> = {}
	response.headers.forEach((value, key) => { headers[key.toLowerCase()] = value })
	const html = await response.text()
	return { ok: response.ok, status: response.status, html, headers }
}

function urlCheck(_url: string): void {}
