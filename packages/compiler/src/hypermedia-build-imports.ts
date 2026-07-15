import { parseSync } from 'oxc-parser'
import { analyzeBuildScriptForEditor } from './build-script-analysis'
import { HYPERMEDIA_HTTP_METHOD_SET } from './event-handler-action-scope'

/** Package specifier for hypermedia action helpers. */
export const HYPERMEDIA_PACKAGE_SPECIFIER = '@aero-js/hypermedia'

export const HYPERMEDIA_BUILD_IMPORT_MESSAGE =
	'Hypermedia actions (GET, POST, …) cannot be imported in `<script is:build>`. Import them in `<script is:state>`, or use them directly in `on:*` handlers.'

export const HYPERMEDIA_STATE_IMPORT_MESSAGE =
	'Hypermedia actions used in `<script is:state>` must be imported from `@aero-js/hypermedia`. `on:*` handlers can use them without an import.'

export interface HypermediaBuildImportHit {
	readonly local: string
	readonly imported: string
	readonly start: number
	readonly end: number
}

export interface HypermediaMissingStateImportHit {
	readonly name: string
	readonly start: number
	readonly end: number
}

export function isHypermediaActionImport(specifier: string, imported: string): boolean {
	return specifier === HYPERMEDIA_PACKAGE_SPECIFIER && HYPERMEDIA_HTTP_METHOD_SET.has(imported)
}

/** Find GET/POST/… named imports from `@aero-js/hypermedia` in a script body. */
export function collectHypermediaActionImportsInBuildScript(
	script: string
): HypermediaBuildImportHit[] {
	if (!script.trim()) return []
	let imports: ReturnType<typeof analyzeBuildScriptForEditor>['imports']
	try {
		imports = analyzeBuildScriptForEditor(script).imports
	} catch {
		return []
	}

	const hits: HypermediaBuildImportHit[] = []
	for (const imp of imports) {
		for (const binding of imp.namedBindings) {
			if (!isHypermediaActionImport(imp.specifier, binding.imported)) continue
			const range = imp.bindingRanges?.[binding.local] ?? imp.range
			hits.push({
				local: binding.local,
				imported: binding.imported,
				start: range[0],
				end: range[1],
			})
		}
	}
	return hits
}

type AstNode = {
	type?: string
	name?: string
	start?: number
	end?: number
	callee?: AstNode
	[key: string]: unknown
}

function walkAst(node: unknown, visit: (node: AstNode) => void): void {
	if (!node || typeof node !== 'object') return
	const current = node as AstNode
	visit(current)
	for (const value of Object.values(current)) {
		if (Array.isArray(value)) {
			for (const item of value) walkAst(item, visit)
			continue
		}
		if (value && typeof value === 'object') walkAst(value, visit)
	}
}

/**
 * Find HTTP action calls in `is:state` that are not imported from `@aero-js/hypermedia`.
 * Intrinsic `on:*` handlers are out of scope — pass only the state script body.
 */
export function collectMissingHypermediaActionImportsInStateScript(
	script: string
): HypermediaMissingStateImportHit[] {
	if (!script.trim()) return []
	const importedLocals = new Set(
		collectHypermediaActionImportsInBuildScript(script).map(hit => hit.local)
	)

	let program: unknown
	try {
		const parsed = parseSync('state.ts', script, { sourceType: 'module', range: true, lang: 'ts' })
		if (parsed.errors.length > 0) return []
		program = parsed.program
	} catch {
		return []
	}

	const hits: HypermediaMissingStateImportHit[] = []
	const seen = new Set<string>()
	walkAst(program, node => {
		if (node.type !== 'CallExpression') return
		const callee = node.callee
		if (!callee || callee.type !== 'Identifier') return
		const name = callee.name
		if (!name || !HYPERMEDIA_HTTP_METHOD_SET.has(name)) return
		if (importedLocals.has(name)) return
		if (seen.has(name)) return
		seen.add(name)
		hits.push({
			name,
			start: typeof callee.start === 'number' ? callee.start : 0,
			end: typeof callee.end === 'number' ? callee.end : name.length,
		})
	})
	return hits
}
