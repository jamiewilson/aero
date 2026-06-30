import type { IRNode } from './ir'

/** Layout component module names (`base` for `<base-layout>`) used in a page template. */
export function collectLayoutModuleNames(bodyIR: readonly IRNode[]): string[] {
	const names = new Set<string>()
	const walk = (nodes: readonly IRNode[]): void => {
		for (const node of nodes) {
			if (node.kind === 'Component') {
				if (node.isLayout) names.add(node.baseName)
				for (const slotIR of Object.values(node.slots)) walk(slotIR)
			}
			if (node.kind === 'For') walk(node.body)
			if (node.kind === 'If') {
				walk(node.body)
				for (const branch of node.elseIf ?? []) walk(branch.body)
				if (node.else) walk(node.else)
			}
			if (node.kind === 'Switch') {
				for (const branch of node.cases) walk(branch.body)
				if (node.defaultBody) walk(node.defaultBody)
			}
		}
	}
	walk(bodyIR)
	return [...names]
}

function layoutMountLines(layoutModuleNames: readonly string[]): string {
	return layoutModuleNames
		.map(
			name =>
				`\tconst __aeroLayoutCleanup_${name} = __aeroMod_${name}.mountStateBindings?.(root.ownerDocument?.documentElement ?? root, Aero, opts);\n\tif (typeof __aeroLayoutCleanup_${name} === 'function') cleanups.push(__aeroLayoutCleanup_${name});`
		)
		.join('\n')
}

/** Page-only mount: delegate to layout module(s) on `document.documentElement`. */
export function emitLayoutOnlyMountExport(layoutModuleNames: readonly string[]): string {
	if (layoutModuleNames.length === 0) return ''
	return `export function mountStateBindings(root, Aero, opts = {}) {
	const cleanups = []
${layoutMountLines(layoutModuleNames)}
	return () => { for (const c of cleanups) c() }
}`
}

/** Prepend layout mount calls inside an existing page mount export body. */
export function prependLayoutMountsToPageExport(
	pageMountExport: string,
	layoutModuleNames: readonly string[]
): string {
	if (layoutModuleNames.length === 0) return pageMountExport
	const layoutLines = layoutMountLines(layoutModuleNames)
	return pageMountExport
		.replace(
			/export function mountStateBindings\(root, Aero, opts = \{\}\) \{\n/,
			`export function mountStateBindings(root, Aero, opts = {}) {
	const cleanups = []
${layoutLines}
`
		)
		.replace(/return __aeroMountStateBindings\(/, `const pageCleanup = __aeroMountStateBindings(`)
		.replace(
			/\}\)\n\}$/,
			`})
	if (typeof pageCleanup === 'function') cleanups.push(pageCleanup)
	return () => { for (const c of cleanups) c() }
}`
		)
}
