import fs from 'node:fs/promises'
import path from 'node:path'
import { renderTemplate } from './standalone'
import type { AeroRenderInput } from '../types'

/**
 * Fragment rendering for hypermedia handlers.
 *
 * `<aero-async>` is out of scope for Phase 6 — fragments are request-time partial
 * renders, not a structural async primitive.
 */
export interface RenderAeroFragmentOptions {
	readonly root: string
	readonly resolvePath?: (specifier: string, importer: string) => string
	readonly input?: AeroRenderInput
}

export async function renderAeroFragment(
	templatePath: string,
	props: Record<string, unknown> = {},
	options: RenderAeroFragmentOptions
): Promise<string> {
	const { root, resolvePath, input } = options
	if (!root) throw new Error('[aero] renderAeroFragment requires `root`.')
	if (!templatePath) throw new Error('[aero] renderAeroFragment requires `templatePath`.')

	const importer = path.isAbsolute(templatePath)
		? templatePath
		: path.resolve(root, templatePath)
	const templateSource = await fs.readFile(importer, 'utf8')
	const html = await renderTemplate({
		templateSource,
		root,
		importer,
		resolvePath,
		input: {
			...input,
			props: {
				...(input?.props ?? {}),
				...props,
			},
			params: {
				...(input?.params ?? {}),
			},
		},
	})

	if (html == null) {
		throw new Error(`[aero] Failed to render Aero fragment: ${importer}`)
	}

	return html
}

const DEFAULT_FRAGMENT_HEADERS: Readonly<Record<string, string>> = {
	'content-type': 'text/html; charset=utf-8',
	'cache-control': 'private, no-cache',
	vary: 'Accept',
}

export function fragmentResponse(html: string, init: ResponseInit = {}): Response {
	const headers = new Headers(init.headers)
	for (const [name, value] of Object.entries(DEFAULT_FRAGMENT_HEADERS)) {
		if (!headers.has(name)) headers.set(name, value)
	}
	return new Response(html, {
		...init,
		headers,
	})
}
