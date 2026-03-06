/**
 * Ambient type declarations for Aero templates.
 *
 * Include in your project by adding `"types": ["@aero-js/core/env"]` to tsconfig.json,
 * or via a triple-slash directive: `/// <reference types="@aero-js/core/env" />`
 *
 * These declarations type the globals available inside `<script is:build>` blocks.
 *
 * Single source of truth: the language server generates its preamble from this file.
 * When changing globals (Aero, renderComponent, *.html, aero:content), run:
 *   pnpm --dir packages/language-server exec npm run prebuild
 */

/**
 * The `Aero` context object available in build scripts. Provides access to
 * component props, request data, and rendering utilities.
 *
 * Use `Aero.props` (capital A). The lowercase `aero` is not defined at runtime.
 */
declare const Aero: {
	/** Props passed to the current component or page. */
	props: Record<string, any>
	/** Named slot content (key to HTML string). */
	slots: Record<string, string>
	/** The incoming request (available during SSR). */
	request: Request
	/** The request URL. */
	url: URL
	/** Dynamic route parameters (e.g. `{ id: '42' }` for `/posts/[id]`). */
	params: Record<string, string>
	/** Canonical site URL from `aero.config` (e.g. `'https://example.com'`). */
	site?: string
}

/**
 * Render a child component and return its HTML.
 *
 * @param component - The imported component (default import from an `.html` file).
 * @param props - Props to pass to the component.
 * @param slots - Named slot content.
 * @returns The rendered HTML string.
 */
declare function renderComponent(
	component: any,
	props?: Record<string, any>,
	slots?: Record<string, string>,
): Promise<string>

/** Allows importing `.html` component files in build scripts. */
declare module '*.html' {
	const component: string
	export default component
}

/** Content collections: getCollection, render. Used by the language server for IntelliSense. */
declare module 'aero:content' {
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
