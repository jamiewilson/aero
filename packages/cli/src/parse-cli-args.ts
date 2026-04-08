/**
 * CLI argv parsing (shared with tests).
 */
import path from 'node:path'

type ParseCliRootResult =
	| { ok: true; root: string; rest: string[] }
	| { ok: false; message: string }

/**
 * Parse optional `--root <dir>` and return remaining args (subcommand + flags).
 * Requires a path after `--root`; trailing `--root` is an error (not `Unknown command: --root`).
 */
export function parseRootArgs(args: string[]): ParseCliRootResult {
	let root = process.cwd()
	const rest: string[] = []
	for (let i = 0; i < args.length; i++) {
		const a = args[i]
		if (a === '--root') {
			const next = args[i + 1]
			if (next === undefined || next.startsWith('-')) {
				return {
					ok: false,
					message: 'Error: --root requires a directory path (e.g. aero check --root ./my-app)',
				}
			}
			root = path.resolve(next)
			i++
			continue
		}
		rest.push(a)
	}
	return { ok: true, root, rest }
}
