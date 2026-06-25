import type { IRReactiveEventBind } from './ir'
import { extractStaticActionUrl } from './hypermedia-script-analysis'

export interface HypermediaFallbackAttrs {
	readonly href?: string
	readonly action?: string
	readonly method?: string
	readonly methodOverride?: 'PUT' | 'PATCH' | 'DELETE'
}

export function deriveHypermediaFallbackAttrs(
	tagName: string,
	eventBind: IRReactiveEventBind | undefined
): HypermediaFallbackAttrs | null {
	if (!eventBind) return null
	const action = extractStaticActionUrl(eventBind.handlerExpr)
	if (!action) return null

	const tag = tagName.toLowerCase()

	if (action.method === 'GET' && tag === 'a') {
		return { href: action.url }
	}

	if (action.method === 'POST' && tag === 'form') {
		return { action: action.url, method: 'post' }
	}

	if (['PUT', 'PATCH', 'DELETE'].includes(action.method) && tag === 'form') {
		return {
			action: action.url,
			method: 'post',
			methodOverride: action.method as 'PUT' | 'PATCH' | 'DELETE',
		}
	}

	if (['PUT', 'PATCH', 'DELETE'].includes(action.method) && tag === 'a') {
		return null
	}

	return null
}

export function renderFallbackAttributeString(attrs: HypermediaFallbackAttrs): string {
	const parts: string[] = []
	if (attrs.href) parts.push(`href="${attrs.href}"`)
	if (attrs.action) parts.push(`action="${attrs.action}"`)
	if (attrs.method) parts.push(`method="${attrs.method}"`)
	return parts.join(' ')
}

export function renderMethodOverrideInput(method: 'PUT' | 'PATCH' | 'DELETE'): string {
	return `<input type="hidden" name="_method" value="${method}">`
}
