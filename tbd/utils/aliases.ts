import type { UserAlias, AliasResult } from '../types'
import path from 'node:path'
import { getTsconfig } from 'get-tsconfig'

export function loadTsconfigAliases(root: string): AliasResult {
	const result = getTsconfig(root)
	if (!result) return { aliases: [], resolvePath: undefined }

	const config = result.config
	const options = config.compilerOptions
	const paths = options?.paths || {}
	const baseUrl = options?.baseUrl || '.'
	const baseDir = path.resolve(path.dirname(result.path || root), baseUrl)
	const aliases: UserAlias[] = []

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
