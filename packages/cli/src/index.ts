#!/usr/bin/env node
/**
 * @aero-js/cli — `aero check`, `aero doctor`, … (Phase 5).
 */
import { runAeroCheck } from './check'
import { runAeroDoctor } from './doctor'
import { parseRootArgs } from './parse-cli-args'

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

async function main(): Promise<void> {
	const argv = process.argv.slice(2)
	if (argv[0] === '--help' || argv[0] === '-h') {
		printHelp()
		process.exit(0)
	}
	const parsed = parseRootArgs(argv)
	if (!parsed.ok) {
		process.stderr.write(parsed.message + '\n\n')
		printHelp()
		process.exit(1)
	}
	const { root, rest } = parsed
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
