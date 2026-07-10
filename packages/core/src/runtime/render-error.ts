import fs from 'node:fs/promises'
import path from 'node:path'
import { ERROR_PAGE_NAME, resolveErrorTemplatePath } from '../routing/error-pages'
import { loadTsconfigAliases, mergeWithDefaultAliases } from '../utils/aliases'
import { resolveDirs } from '../vite/defaults'
import { renderTemplate } from './standalone'
import type { AeroErrorContext, AeroRenderInput } from '../types'

export interface RenderAeroErrorOptions {
	readonly root: string
	readonly clientDir?: string
	readonly error: AeroErrorContext
	readonly input?: Omit<AeroRenderInput, 'error'>
	readonly resolvePath?: (specifier: string, importer: string) => string
}

export async function renderAeroError(options: RenderAeroErrorOptions): Promise<string> {
	const { root, error, input, resolvePath: resolvePathOverride } = options
	const clientDir = options.clientDir ?? 'client'
	const templatePath = resolveErrorTemplatePath(root, clientDir)
	const templateSource = await fs.readFile(templatePath, 'utf8')
	const mergedAliases = mergeWithDefaultAliases(
		loadTsconfigAliases(root),
		root,
		resolveDirs({ client: clientDir })
	)
	const resolvePath = resolvePathOverride ?? mergedAliases.resolve
	const importer = templatePath

	const pageUrl = input?.page?.url ?? input?.url ?? new URL('/', 'http://localhost')
	const url = pageUrl instanceof URL ? pageUrl : new URL(String(pageUrl), 'http://localhost')
	const request =
		input?.page?.request ??
		input?.request ??
		new Request(url.toString(), { method: 'GET' })

	const html = await renderTemplate({
		templateSource,
		root,
		importer,
		resolvePath,
		input: {
			...input,
			error,
			url,
			request,
			page: {
				url,
				request,
				params: input?.page?.params ?? input?.params ?? {},
				routePath: input?.page?.routePath ?? input?.routePath ?? (url.pathname || '/'),
			},
		},
	})

	if (html == null) {
		throw new Error(`[aero] Failed to render error template: ${templatePath}`)
	}

	return html
}

export { ERROR_PAGE_NAME }
