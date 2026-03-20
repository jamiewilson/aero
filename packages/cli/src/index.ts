#!/usr/bin/env node
/**
 * @aero-js/cli — `aero check`, `aero doctor`, … (Phase 5).
 */
import { runAeroCheck } from './check'
import { runAeroDoctor } from './doctor'
import path from 'node:path'

function printHelp(): void {
	process.stdout.write(`Aero — HTML-first static sites

Usage:
  aero check [--root <dir>]
  aero doctor [--root <dir>]
  aero --help

  check   Validate config (when present), content collections (when configured), and compile all page/component/layout templates.
  doctor  Print environment checklist (Node, Vite, Aero deps); exits 1 only if Node is below the minimum.
`)
}

function parseRoot(args: string[]): { root: string; rest: string[] } {
	let root = process.cwd()
	const rest: string[] = []
	for (let i = 0; i < args.length; i++) {
		const a = args[i]
		if (a === '--root' && args[i + 1]) {
			root = path.resolve(args[++i])
		} else {
			rest.push(a)
		}
	}
	return { root, rest }
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2)
	if (argv[0] === '--help' || argv[0] === '-h') {
		printHelp()
		process.exit(0)
	}
	const { root, rest } = parseRoot(argv)
	const cmd = rest[0]
	if (cmd === 'check') {
		const code = await runAeroCheck(root)
		process.exit(code)
	}
	if (cmd === 'doctor') {
		const code = runAeroDoctor(root)
		process.exit(code)
	}
	if (!cmd) {
		printHelp()
		process.exit(1)
	}
	process.stderr.write(`Unknown command: ${cmd}\n\n`)
	printHelp()
	process.exit(1)
}

main().catch(err => {
	process.stderr.write(String(err?.stack ?? err) + '\n')
	process.exit(1)
})
