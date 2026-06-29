import type { RetryMode } from './types'

export const MAX_REQUEST_ATTEMPTS = 3

export function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'AbortError'
}

export function shouldRetryStatus(status: number, retry: RetryMode): boolean {
	if (retry === 'never') return false
	if (status >= 400 && status < 500) return false
	if (retry === 'error' && status >= 500) return true
	return false
}

export function shouldRetryError(error: unknown, retry: RetryMode): boolean {
	if (retry === 'never' || isAbortError(error)) return false
	return true
}

export function applySelectFilter(html: string, select: string | undefined): string | null {
	if (!select) return html
	const template = document.createElement('template')
	template.innerHTML = html
	const match = template.content.querySelector(select)
	if (!match) return null
	return match.outerHTML
}
