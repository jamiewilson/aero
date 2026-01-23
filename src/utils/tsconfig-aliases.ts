import path from 'node:path'
import { getTsconfig } from 'get-tsconfig'

export interface TsconfigAliasResult {
	aliases: { find: string; replacement: string }[]
	resolvePath?: (specifier: string) => string
}

export function loadTsconfigAliases(root: string): TsconfigAliasResult {
	const result = getTsconfig(root)
	if (!result) return { aliases: [], resolvePath: undefined }

	const tsconfig =
		(result as any).config || (result as any).tsconfig || (result as any).data || {}
	const compilerOptions = tsconfig.compilerOptions || {}
	const paths = (compilerOptions.paths || {}) as Record<string, unknown>
	const baseUrl = compilerOptions.baseUrl
	const baseDir = path.resolve(path.dirname((result as any).path || root), baseUrl || '.')

	const entries: { find: string; replacement: string }[] = []
	for (const [key, values] of Object.entries(paths)) {
		const valueArr = Array.isArray(values) ? values : []
		const first = valueArr[0]
		if (typeof first !== 'string' || first.length === 0) continue
		const find = key.replace(/\/*$/, '').replace('/*', '')
		const target = first.replace(/\/*$/, '').replace('/*', '')
		const replacement = path.resolve(baseDir, target)
		entries.push({ find, replacement })
	}

	const resolvePath = (id: string) => {
		for (const entry of entries) {
			if (id === entry.find || id.startsWith(`${entry.find}/`)) {
				const rest = id.slice(entry.find.length)
				return path.join(entry.replacement, rest)
			}
		}
		return id
	}

	return { aliases: entries, resolvePath }
}
