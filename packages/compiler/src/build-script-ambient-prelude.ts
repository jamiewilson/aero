/**
 * Ambient prelude for `<script is:build>` TypeScript checking — must match
 * `BUILD_SCRIPT_PREAMBLE` in `packages/language-server/src/generated/ambient-preamble.ts`
 * (generated from `packages/core/env.d.ts`).
 *
 * @remarks
 * After changing `env.d.ts`, run `pnpm --dir packages/language-server exec node scripts/generate-ambient-preamble.mjs`
 * and sync this string with `BUILD_SCRIPT_PREAMBLE`.
 */
export const BUILD_SCRIPT_AMBIENT_PRELUDE = `declare const Aero: {
	
	props: Record<string, any>
	
	slots: Record<string, string>
	
	page: { url: URL; request: Request; params: Record<string, string> }
	
	site: { url: string }
}

declare namespace Aero {
	interface ComponentRegistry {}
}

declare function renderComponent<K extends keyof Aero.ComponentRegistry>(
	component: K,
	props?: Aero.ComponentRegistry[K] extends { props: infer P } ? P : Record<string, unknown>,
	slots?: Record<string, string>
): Promise<string>
declare function renderComponent(
	component: any,
	props?: Record<string, any>,
	slots?: Record<string, string>
): Promise<string>

declare function raw(value: unknown): string

declare module '*.html' {
	const component: string
	export default component
}

declare module '*.md' {
	interface ContentMeta {
		path: string
		slug: string
		filename: string
		extension: string
	}
	interface ContentDocument {
		id: string
		data: Record<string, any>
		body: string
		_meta: ContentMeta
	}
	const doc: ContentDocument
	export default doc
}
`

/**
 * `declare module 'aero:content'` — keep in sync with `AMBIENT_DECLARATIONS` in
 * `packages/language-server/src/generated/ambient-preamble.ts`.
 */
export const AERO_CONTENT_MODULE_DECLARATIONS = `declare module 'aero:content' {
	interface CollectionEntry {
		id: string
		data: Record<string, any>
		body?: string
	}
	export function getCollection(name: string): Promise<CollectionEntry[]>
	export function render(entry: CollectionEntry | Record<string, any>): Promise<{ html: string }>
}
`

/** Full prelude for `aero check --types` (build script + virtual imports like `aero:content`). */
export const FULL_BUILD_SCRIPT_AMBIENT_FOR_TYPECHECK =
	BUILD_SCRIPT_AMBIENT_PRELUDE + '\n' + AERO_CONTENT_MODULE_DECLARATIONS + '\n'
