/**
 * Build Aero template context for page and component renders.
 */

import type {
	AeroRenderInput,
	AeroRouteParams,
	AeroTemplateContext,
} from '../types'
import { escapeScriptJson } from '@aero-js/compiler/helpers'
import { formatAttributeBind } from '@aero-js/reactivity'
import { normalizeRoutePath } from '../utils/routing'

export interface CreateTemplateContextDeps {
	globals: Record<string, unknown>
	escapeHtml: (s: unknown) => string
	renderComponent: AeroTemplateContext['renderComponent']
}

export interface CreateTemplateContextInput {
	props?: Record<string, unknown>
	slots?: Record<string, string>
	request?: Request
	url?: URL | string
	params?: AeroRouteParams
	routePath?: string
	site?: string | { url: string }
	page?: AeroRenderInput['page']
	styles?: Set<string>
	scripts?: Set<string>
	headScripts?: Set<string>
}

function toURL(routePath: string, rawUrl?: URL | string): URL {
	if (rawUrl instanceof URL) return rawUrl
	if (typeof rawUrl === 'string' && rawUrl.length > 0) {
		return new URL(rawUrl, 'http://localhost')
	}
	return new URL(routePath, 'http://localhost')
}

/** Build template context: globals, props, slots, page, site, and helpers. */
export function createTemplateContext(
	deps: CreateTemplateContextDeps,
	input: CreateTemplateContextInput
): AeroTemplateContext {
	const routePath = normalizeRoutePath(input.page?.routePath ?? input.routePath ?? '/')
	const pageInput = input.page
	const url = pageInput?.url ?? toURL(routePath, input.url)
	const urlResolved = url instanceof URL ? url : new URL(String(url), 'http://localhost')
	const request =
		pageInput?.request ?? input.request ?? new Request(urlResolved.toString(), { method: 'GET' })
	const params = pageInput?.params ?? input.params ?? {}
	const siteUrl = typeof input.site === 'string' ? input.site : (input.site?.url ?? '')

	const raw = (s: unknown): string => {
		if (s == null) return ''
		return String(s)
	}

	const trim = (s: unknown): string => {
		if (s == null) return ''
		return String(s).trim()
	}

	const trimStart = (s: unknown): string => {
		if (s == null) return ''
		return String(s).trimStart()
	}

	const trimEnd = (s: unknown): string => {
		if (s == null) return ''
		return String(s).trimEnd()
	}

	const bindable = (fallback?: unknown): unknown => fallback

	const createScriptTag = (attrs: string, src: string): string => {
		const normalizedAttrs = attrs.trim()
		return `<script${normalizedAttrs ? ' ' + normalizedAttrs : ''} src="${deps.escapeHtml(src)}"></script>`
	}

	return {
		...deps.globals,
		props: input.props || {},
		slots: input.slots || {},
		page: {
			url: urlResolved,
			request,
			params,
			routePath,
		},
		site: { url: siteUrl },
		styles: input.styles,
		scripts: input.scripts,
		headScripts: input.headScripts,
		renderComponent: deps.renderComponent,
		createScriptTag,
		escapeHtml: deps.escapeHtml,
		formatAttributeBind: (name: string, value: unknown) =>
			formatAttributeBind(name, value, deps.escapeHtml),
		escapeScriptJson,
		bindable,
		raw,
		trim,
		trimStart,
		trimEnd,
	} as AeroTemplateContext
}
