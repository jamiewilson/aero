#!/usr/bin/env node
/**
 * @aero-js/cli — `aero check`, `aero doctor`, … (Phase 5).
 */
import { runAeroBuild } from './build'
import { runAeroCheck } from './check'
import { runAeroDoctor } from './doctor'
import { parseGraphFormat, runAeroGraph } from './graph'
import { parseRootArgs } from './parse-cli-args'

function printHelp(): void {
	process.stdout.write(`Aero — HTML-first static sites

Usage:
  aero check [--root <dir>] [--types]
  aero doctor [--root <dir>]
  aero build [--root <dir>] [--incremental]
  aero graph [--root <dir>] [--format json|lines|fallow-entry]
  aero --help

  check   Validate config (when present), content collections (when configured), and compile all page/component/layout templates.
          --types   After compile, TypeScript-check build scripts and { } interpolations (workspace tsconfig); writes .aero/cache/types/components.d.ts.
  doctor  Print environment checklist (Node, Vite, Aero deps); exits 1 only if Node is below the minimum.
  build   Run vite build (same as pnpm exec vite build). --incremental sets AERO_INCREMENTAL when unset.
  graph   Print entry globs for Fallow/knip-style analyzers (from aero.config dirs). Default: one glob per line.
          --format json           JSON with entryGlobs + discovered template paths.
          --format fallow-entry   JSON object { "entry": [...] } for .fallowrc.json.
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
		const checkRest = rest.slice(1)
		const types = checkRest.includes('--types')
		const code = await runAeroCheck(root, { types })
		process.exit(code)
	}
	if (cmd === 'doctor') {
		const code = runAeroDoctor(root)
		process.exit(code)
	}
	if (cmd === 'build') {
		const buildRest = rest.slice(1)
		const incremental = buildRest.includes('--incremental')
		await runAeroBuild(root, { incremental })
		process.exit(0)
	}
	if (cmd === 'graph') {
		const graphRest = rest.slice(1)
		const { format } = parseGraphFormat(graphRest)
		runAeroGraph(root, format)
		process.exit(0)
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
