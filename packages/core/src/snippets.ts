/**
 * Snippet module parser and ESM codegen for file-based demo code snippets.
 *
 * @see _reference/decisions/adr-snippet-modules.md
 */
import path from 'node:path'

/** Named region of source text for display in demo pages. */
export type Snippet = { readonly code: string; readonly lang: string }

const SNIPPET_ID_RE = /^[A-Za-z][\w-]*$/
const HTML_MARKER_RE = /^\s*<!--\s*@snippet:([A-Za-z][\w-]*)\s*-->\s*$/
const LINE_MARKER_RE = /^\s*\/\/\s*@snippet:([A-Za-z][\w-]*)\s*$/
const HASH_MARKER_RE = /^\s*#\s*@snippet:([A-Za-z][\w-]*)\s*$/
const BLOCK_MARKER_RE = /^\s*\/\*\s*@snippet:([A-Za-z][\w-]*)\s*\*\/\s*$/

/** Extensions that use `<!-- @snippet:id -->` markers. */
const HTML_COMMENT_EXTENSIONS = new Set(['.html', '.htm', '.xml', '.svg', '.md', '.mdx'])
/** Extensions that use `# @snippet:id` markers. */
const HASH_COMMENT_EXTENSIONS = new Set([
	'.py',
	'.sh',
	'.bash',
	'.zsh',
	'.yaml',
	'.yml',
	'.toml',
	'.rb',
	'.tf',
	'.hcl',
	'.nix',
	'.r',
	'.sql',
	'.prisma',
	'.dockerfile',
])
/** Extensions that use `/* @snippet:id *\/` markers. */
const BLOCK_COMMENT_EXTENSIONS = new Set(['.css', '.scss', '.less', '.sass'])

/** Relative path segment for snippet source files (`content/snippets/`). */
export const SNIPPETS_SOURCE_REL = 'content/snippets'

/** True when `filePath` is a file under `content/snippets/`. */
export function isSnippetModulePath(filePath: string): boolean {
	const normalized = filePath.replace(/\\/g, '/')
	if (!normalized.includes(`/${SNIPPETS_SOURCE_REL}/`)) return false
	const base = path.posix.basename(normalized)
	return base.length > 0 && base !== '.' && base !== '..'
}

/** Convert marker id to ESM export name (`second-snippet` → `secondSnippet`). */
export function snippetIdToExportName(id: string): string {
	return id.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function langFromExtension(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase()
	if (!ext) return path.basename(filePath).toLowerCase()
	if (ext === '.htm') return 'html'
	if (ext === '.yml') return 'yaml'
	return ext.slice(1)
}

function markerReForExtension(ext: string): RegExp {
	if (HTML_COMMENT_EXTENSIONS.has(ext)) return HTML_MARKER_RE
	if (HASH_COMMENT_EXTENSIONS.has(ext)) return HASH_MARKER_RE
	if (BLOCK_COMMENT_EXTENSIONS.has(ext)) return BLOCK_MARKER_RE
	return LINE_MARKER_RE
}

function trimSnippetBody(body: string): string {
	if (body.endsWith('\n')) return body.slice(0, -1)
	return body
}

/** @throws SnippetModuleError */
export function parseSnippetModule(source: string, filePath: string): ReadonlyMap<string, Snippet> {
	const ext = path.extname(filePath).toLowerCase()
	const markerRe = markerReForExtension(ext)
	const lang = langFromExtension(filePath)
	const lines = source.split('\n')
	const snippets = new Map<string, Snippet>()

	let currentId: string | null = null
	let bodyLines: string[] = []

	const finalize = (): void => {
		if (currentId === null) return
		const body = trimSnippetBody(bodyLines.join('\n'))
		if (body.length === 0) {
			throw new SnippetModuleError(`Snippet "${currentId}" has an empty body`, filePath)
		}
		const exportName = snippetIdToExportName(currentId)
		if (snippets.has(exportName)) {
			throw new SnippetModuleError(`Duplicate snippet id "${currentId}"`, filePath)
		}
		snippets.set(exportName, { code: body, lang })
		currentId = null
		bodyLines = []
	}

	for (const line of lines) {
		const match = line.match(markerRe)
		if (match) {
			finalize()
			const id = match[1]!
			if (!SNIPPET_ID_RE.test(id)) {
				throw new SnippetModuleError(`Invalid snippet id "${id}"`, filePath)
			}
			currentId = id
			continue
		}
		if (currentId !== null) {
			bodyLines.push(line)
		}
	}

	finalize()

	if (snippets.size === 0) {
		throw new SnippetModuleError('Snippet module contains no @snippet markers', filePath)
	}

	return snippets
}

/** Emit ESM source with one `export const` per snippet. */
export function compileSnippetModule(source: string, filePath: string): string {
	const snippets = parseSnippetModule(source, filePath)
	const exports: string[] = []
	for (const [name, snippet] of snippets) {
		exports.push(
			`export const ${name} = { code: ${JSON.stringify(snippet.code)}, lang: ${JSON.stringify(snippet.lang)} }`
		)
	}
	return exports.join('\n') + '\n'
}

export class SnippetModuleError extends Error {
	constructor(
		message: string,
		readonly filePath?: string
	) {
		super(filePath ? `${message} (${filePath})` : message)
		this.name = 'SnippetModuleError'
	}
}
