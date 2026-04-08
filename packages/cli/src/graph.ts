/**
 * `aero graph` — print Fallow/knip-friendly entry globs and optional template path listing.
 */
import { getAeroAnalyzerEntryGlobs, listAeroTemplatePaths } from '@aero-js/config/analyzer-entries'

type GraphFormat = 'json' | 'lines' | 'fallow-entry'

export function parseGraphFormat(rest: string[]): { format: GraphFormat; rest: string[] } {
	let format: GraphFormat = 'lines'
	const out: string[] = []
	for (let i = 0; i < rest.length; i++) {
		const a = rest[i]
		if (a === '--format' || a === '-f') {
			const v = rest[i + 1]
			if (v === 'json' || v === 'lines' || v === 'fallow-entry') {
				format = v
				i++
				continue
			}
		}
		out.push(a)
	}
	return { format, rest: out }
}

/**
 * @param root - Project root
 * @param format - Output shape
 */
export function runAeroGraph(root: string, format: GraphFormat): void {
	const globs = getAeroAnalyzerEntryGlobs(root)
	const templates = listAeroTemplatePaths(root)

	if (format === 'json') {
		process.stdout.write(
			JSON.stringify(
				{
					entryGlobs: globs,
					templates,
				},
				null,
				2
			) + '\n'
		)
		return
	}

	if (format === 'fallow-entry') {
		process.stdout.write(JSON.stringify({ entry: globs }, null, 2) + '\n')
		return
	}

	for (const g of globs) {
		process.stdout.write(g + '\n')
	}
}
