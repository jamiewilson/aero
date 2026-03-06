/**
 * Generated from @aero-js/core/env.d.ts - do not edit manually.
 * Run: node scripts/generate-ambient-preamble.mjs
 */

export const BUILD_SCRIPT_PREAMBLE = `declare const Aero: {
	
	props: Record<string, any>
	
	slots: Record<string, string>
	
	request: Request
	
	url: URL
	
	params: Record<string, string>
	
	site?: string
}

declare function renderComponent(
	component: any,
	props?: Record<string, any>,
	slots?: Record<string, string>,
): Promise<string>

declare module '*.html' {
	const component: string
	export default component
}
`

export const AMBIENT_DECLARATIONS = `declare module 'aero:content' {
	interface CollectionEntry {
		id: string
		data: Record<string, any>
		body?: string
	}
	export function getCollection(name: string): Promise<CollectionEntry[]>
	export function render(
		entry: CollectionEntry | Record<string, any>,
	): Promise<{ html: string }>
}
`
