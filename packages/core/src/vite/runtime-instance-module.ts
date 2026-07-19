/**
 * Dev/build runtime instance module source: explicit imports per discovered template.
 */

import { toRootRelativeImportUrl } from '../utils/path'
import { discoverRuntimeTemplatePaths } from './runtime-template-discovery'

function appendLines(lines: string[], ...entries: string[]): void {
	lines.push(...entries)
}

/**
 * Dev/build runtime instance module: explicit imports per discovered template (manifest-driven)
 * so Vite HMR invalidates only affected modules instead of eager `import.meta.glob` for everything.
 */
export function getRuntimeInstanceModuleSource(
	root: string,
	clientDir: string,
	runtimeImportPath: string
): string {
	const { components, layouts, pages } = discoverRuntimeTemplatePaths(root, clientDir)
	const lines: string[] = []
	appendLines(
		lines,
		`import { Aero } from ${JSON.stringify(runtimeImportPath)}`,
		'',
		`const instance = globalThis.__AERO_INSTANCE__ || new Aero()`,
		`const listeners = globalThis.__AERO_LISTENERS__ || new Set()`,
		`const aero = instance`,
		'',
		`const onUpdate = (cb) => {`,
		`\tlisteners.add(cb)`,
		`\treturn () => listeners.delete(cb)`,
		`}`,
		`const notify = () => {`,
		`\tlisteners.forEach((cb) => cb())`,
		`}`,
		'',
		`if (!globalThis.__AERO_INSTANCE__) globalThis.__AERO_INSTANCE__ = instance`,
		`if (!globalThis.__AERO_LISTENERS__) globalThis.__AERO_LISTENERS__ = listeners`,
		''
	)

	const compEntries: string[] = []
	for (let i = 0; i < components.length; i++) {
		const url = toRootRelativeImportUrl(root, components[i]!)
		const name = `__aero_c${i}`
		lines.push(`import * as ${name} from ${JSON.stringify(url)}`)
		compEntries.push(`${JSON.stringify(url)}: ${name}`)
	}
	lines.push(`const components = { ${compEntries.join(', ')} }`)

	const layEntries: string[] = []
	for (let i = 0; i < layouts.length; i++) {
		const url = toRootRelativeImportUrl(root, layouts[i]!)
		const name = `__aero_l${i}`
		lines.push(`import * as ${name} from ${JSON.stringify(url)}`)
		layEntries.push(`${JSON.stringify(url)}: ${name}`)
	}
	lines.push(`const layouts = { ${layEntries.join(', ')} }`)

	const pageEntries: string[] = []
	for (let i = 0; i < pages.length; i++) {
		const url = toRootRelativeImportUrl(root, pages[i]!)
		const name = `__aero_p${i}`
		lines.push(`import * as ${name} from ${JSON.stringify(url)}`)
		pageEntries.push(`${JSON.stringify(url)}: ${name}`)
	}
	lines.push(`const pages = { ${pageEntries.join(', ')} }`)
	appendLines(
		lines,
		'',
		`aero.registerPages(components)`,
		`aero.registerPages(layouts)`,
		`aero.registerPages(pages)`,
		'',
		`notify()`,
		'',
		`if (import.meta.hot) import.meta.hot.accept()`,
		'',
		`export { aero, onUpdate }`,
		''
	)
	return lines.join('\n')
}
