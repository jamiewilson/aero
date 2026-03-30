/**
 * Build-script value bindings for Aero tooling (language server ambient decls, VS Code diagnostics).
 *
 * @remarks {@link iterateBuildScriptBindings} is the single implementation; consumers derive names or full ranges from it.
 */
import { analyzeBuildScriptForEditor } from './build-script-analysis'

function maskJsComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, match => ' '.repeat(match.length))
}

function collectObjectLiteralKeys(initializer: string): Set<string> {
	const properties = new Set<string>()
	const keyRegex = /([A-Za-z_$][\w$]*)\s*:/g
	let keyMatch: RegExpExecArray | null
	while ((keyMatch = keyRegex.exec(initializer)) !== null) {
		properties.add(keyMatch[1])
	}
	const shorthandRegex = /(?:\{|,)\s*([A-Za-z_$][\w$]*)\s*(?:,|\})/g
	while ((keyMatch = shorthandRegex.exec(initializer)) !== null) {
		properties.add(keyMatch[1])
	}
	return properties
}

export type BuildScriptBindingKind = 'import' | 'declaration' | 'function'

export type BuildScriptBinding = {
	name: string
	/** Offset in `content` (0-based, inclusive). */
	start: number
	/** Offset in `content` (exclusive). */
	end: number
	kind: BuildScriptBindingKind
	/** Set when a simple declaration uses an object literal initializer. */
	properties?: ReadonlySet<string>
}

export type IterateBuildScriptBindingsOptions = {
	/**
	 * Omit static import bindings (e.g. inline scripts where import analysis is skipped).
	 */
	skipImports?: boolean
}

/**
 * Yields value-like bindings in document order: imports, simple const/let/var, destructuring, then `function` declarations.
 *
 * @param content - Inner text of a `<script>` block.
 */
export function* iterateBuildScriptBindings(
	content: string,
	options: IterateBuildScriptBindingsOptions = {}
): Generator<BuildScriptBinding> {
	if (!content.trim()) return

	const masked = maskJsComments(content)
	const skipImports = options.skipImports === true

	if (!skipImports) {
		try {
			const { imports } = analyzeBuildScriptForEditor(content)
			for (const imp of imports) {
				const bindingRanges = imp.bindingRanges ?? {}
				for (const [localName, range] of Object.entries(bindingRanges)) {
					if (!localName) continue
					const [start, end] = range as [number, number]
					yield { name: localName, start, end, kind: 'import' }
				}
			}
		} catch {
			// Parse errors: regex passes below may still find declarations.
		}
	}

	const simpleDeclRegex =
		/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*[\w.$<>,\s\[\]|{}]+)?\s*=\s*(\{[\s\S]*?\})?/g
	let declMatch: RegExpExecArray | null
	while ((declMatch = simpleDeclRegex.exec(masked)) !== null) {
		const name = declMatch[1]
		const initializer = declMatch[2]
		const nameOffsetInFullMatch = declMatch[0].indexOf(name)
		const start = declMatch.index + nameOffsetInFullMatch
		const end = start + name.length

		const binding: BuildScriptBinding = { name, start, end, kind: 'declaration' }
		if (initializer) {
			const properties = collectObjectLiteralKeys(initializer)
			if (properties.size > 0) binding.properties = properties
		}
		yield binding
	}

	const destructuringRegex = /\b(?:const|let|var)\s+\{([^}]+)\}\s*=/g
	while ((declMatch = destructuringRegex.exec(masked)) !== null) {
		const body = declMatch[1]
		const bodyStart = declMatch.index + declMatch[0].indexOf(body)

		const parts = body.split(',')
		let currentOffset = 0
		for (const part of parts) {
			const trimmed = part.trim()
			if (!trimmed) {
				currentOffset += part.length + 1
				continue
			}

			const colonIndex = trimmed.indexOf(':')
			let localName = trimmed
			if (colonIndex > -1) {
				localName = trimmed.slice(colonIndex + 1).trim()
			}

			const partIndex = body.indexOf(part, currentOffset)
			const localIndex = part.lastIndexOf(localName)
			const absStart = bodyStart + partIndex + localIndex

			if (localName.length > 0) {
				yield {
					name: localName,
					start: absStart,
					end: absStart + localName.length,
					kind: 'declaration',
				}
			}
			currentOffset = partIndex + part.length
		}
	}

	const fnRegex = /\bfunction\s+\*?\s*([A-Za-z_$][\w$]*)\s*\(/g
	let fnMatch: RegExpExecArray | null
	while ((fnMatch = fnRegex.exec(masked)) !== null) {
		const name = fnMatch[1]
		const start = fnMatch.index + fnMatch[0].indexOf(name)
		yield { name, start, end: start + name.length, kind: 'function' }
	}
}

/**
 * Adds binding names from one build script body (deduped set; order not significant).
 */
export function collectBindingsFromBuildScriptContent(content: string, into: Set<string>): void {
	for (const b of iterateBuildScriptBindings(content)) {
		into.add(b.name)
	}
}

/**
 * Renders ambient declarations so each name is a legal value reference in template expr TS.
 */
export function formatBuildBindingAmbientBlock(names: ReadonlySet<string>): string {
	if (names.size === 0) return ''
	return [...names]
		.filter(n => n.length > 0)
		.sort()
		.map(n => `declare const ${n}: any;`)
		.join('\n') + '\n'
}

/**
 * Union of bindings from every build script body in the document.
 */
export function collectBuildScopeBindingNames(buildScriptContents: Iterable<string>): Set<string> {
	const names = new Set<string>()
	for (const scriptBody of buildScriptContents) {
		if (!scriptBody.trim()) continue
		collectBindingsFromBuildScriptContent(scriptBody, names)
	}
	return names
}
