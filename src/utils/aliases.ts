import { getTsconfig } from 'get-tsconfig'
import path from 'node:path'

type UserAliases = Array<{ find: string; replacement: string }>

export interface TsconfigAliasResult {
	aliases: UserAliases
	resolvePath?: (specifier: string) => string
}

export function loadTsconfigAliases(root: string): TsconfigAliasResult {
	const result = getTsconfig(root)
	if (!result) return { aliases: [], resolvePath: undefined }

	const config = result.config
	const options = config.compilerOptions
	const paths = options?.paths || {}
	const baseUrl = options?.baseUrl || '.'
	const baseDir = path.resolve(path.dirname(result.path || root), baseUrl)
	const aliases: UserAliases = []

	for (const [key, values] of Object.entries(paths)) {
		const valueArr = Array.from(values)
		const first = valueArr[0]
		if (typeof first !== 'string' || first.length === 0) continue

		const find = key.replace(/\/*$/, '').replace('/*', '')
		const target = first.replace(/\/*$/, '').replace('/*', '')
		const replacement = path.resolve(baseDir, target)
		aliases.push({ find, replacement })
	}

	const resolvePath = (id: string) => {
		for (const entry of aliases) {
			if (id === entry.find || id.startsWith(`${entry.find}/`)) {
				const rest = id.slice(entry.find.length)
				return path.join(entry.replacement, rest)
			}
		}
		return id
	}

	return { aliases: aliases, resolvePath }
}
