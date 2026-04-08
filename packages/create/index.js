#!/usr/bin/env node

import { cpSync, mkdirSync, existsSync, statSync, readdirSync, readFileSync } from 'fs'
import { dirname, join, basename, relative } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'
import { parseArgs, rewritePackageJson, writeReadme, findWorkspaceRoot } from './lib.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const startPkgDir = __dirname
const APPS_DIR = 'dist'

const TEMPLATES = ['minimal', 'fullstack']

function resolveTemplatePath(templateName) {
	const pkgName = `@aero-js/starter-${templateName}`
	try {
		const pkgUrl = import.meta.resolve(`${pkgName}/package.json`)
		const templatePath = dirname(fileURLToPath(pkgUrl))
		return templatePath
	} catch {
		console.error(`[create-aero] template "${templateName}" not found.`)
		console.error(`Please install with: npm install -g ${pkgName} (or locally)`)
		process.exit(1)
	}
}

function copyTemplate(src, dest) {
	const ignore = name => {
		if (name === 'node_modules') return true
		if (name === '.git') return true
		if (name === 'dist' || name === '.output') return true
		if (name.endsWith('.log') || name === '.DS_Store') return true
		if (name === '.vite' || name === '.nitro') return true
		if (name === 'package.json' || name === 'package-template.json') return true
		return false
	}
	mkdirSync(dest, { recursive: true })
	cpSync(src, dest, {
		recursive: true,
		dereference: true,
		filter: source => {
			const name = basename(source)
			return !ignore(name)
		},
	})
}

function isInMonorepo() {
	try {
		const aeroRoot = join(startPkgDir, '..', '..')
		if (!existsSync(join(aeroRoot, 'pnpm-workspace.yaml'))) return false
		// Only use monorepo layout (scaffold into dist/) when run from inside this repo
		const cwdWorkspaceRoot = findWorkspaceRoot(process.cwd())
		return cwdWorkspaceRoot !== null && cwdWorkspaceRoot === aeroRoot
	} catch {
		return false
	}
}

function installInMonorepo(targetDir) {
	const root = findWorkspaceRoot(targetDir)
	if (!root) {
		console.error('[create-aero] could not find workspace root (pnpm-workspace.yaml).')
		process.exit(1)
	}
	const r = spawnSync('pnpm', ['install', '--no-frozen-lockfile'], {
		stdio: 'inherit',
		cwd: root,
		shell: true,
	})
	if (r.status !== 0) {
		console.error('[create-aero] pnpm install failed. Run "pnpm install" from the repo root.')
		process.exit(1)
	}
}

function installStandalone(targetDir) {
	const userAgent = process.env.npm_config_user_agent || ''
	let cmd = 'pnpm' // prefer pnpm as default for Aero
	if (userAgent.startsWith('yarn')) cmd = 'yarn'
	else if (userAgent.startsWith('npm')) cmd = 'npm'
	else if (userAgent.startsWith('bun')) cmd = 'bun'

	const args = ['install']
	if (cmd === 'npm') args.push('--legacy-peer-deps')

	const r = spawnSync(cmd, args, {
		stdio: 'inherit',
		cwd: targetDir,
		shell: true,
	})
	if (r.status !== 0) {
		console.error(
			`[create-aero] ${cmd} install failed. Run "${cmd} install" in the project directory.`
		)
		process.exit(1)
	}
}

/**
 * After scaffold, optionally run `aero doctor`, `aero check`, and a best-effort `aero check --types`
 * when `--strict` is set.
 * @param {string} targetDir
 * @param {boolean} inMonorepo
 */
function runOptionalStrictChecks(targetDir, inMonorepo) {
	const rDoctor = inMonorepo
		? spawnSync('pnpm', ['exec', 'aero', 'doctor'], {
				stdio: 'inherit',
				cwd: targetDir,
				shell: true,
			})
		: spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'aero', 'doctor'], {
				stdio: 'inherit',
				cwd: targetDir,
				shell: true,
			})
	if (rDoctor.status !== 0) {
		console.error('[create-aero] aero doctor reported issues (see above). Continuing.')
	}
	const rCheck = inMonorepo
		? spawnSync('pnpm', ['exec', 'aero', 'check'], {
				stdio: 'inherit',
				cwd: targetDir,
				shell: true,
			})
		: spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'aero', 'check'], {
				stdio: 'inherit',
				cwd: targetDir,
				shell: true,
			})
	if (rCheck.status !== 0) {
		console.error('[create-aero] aero check reported issues (see above). Fix before shipping.')
	}

	const rCheckTypes = inMonorepo
		? spawnSync('pnpm', ['exec', 'aero', 'check', '--types'], {
				stdio: 'inherit',
				cwd: targetDir,
				shell: true,
			})
		: spawnSync(
				process.platform === 'win32' ? 'npx.cmd' : 'npx',
				['--yes', 'aero', 'check', '--types'],
				{
					stdio: 'inherit',
					cwd: targetDir,
					shell: true,
				}
			)
	if (rCheckTypes.status !== 0) {
		console.error(
			'[create-aero] aero check --types did not complete cleanly (best-effort). ' +
				'You can run it later with: pnpm exec aero check --types'
		)
	}
}

function main() {
	const { target, template, strict } = parseArgs(process.argv)

	if (!target) {
		console.error('[create-aero] missing target directory.')
		console.error('Usage: pnpm create @aero-js <dir> [--template minimal|fullstack] [--strict]')
		console.error('Example: pnpm create @aero-js my-app')
		process.exit(1)
	}

	if (!TEMPLATES.includes(template)) {
		console.error(
			`[create-aero] unknown template "${template}". Use one of: ${TEMPLATES.join(', ')}`
		)
		process.exit(1)
	}

	// Run from packages/create: scaffold into packages/create/dist/<target>
	const inMonorepo = isInMonorepo()
	const targetDir = inMonorepo ? join(startPkgDir, APPS_DIR, target) : join(process.cwd(), target)

	if (inMonorepo) {
		mkdirSync(join(startPkgDir, APPS_DIR), { recursive: true })
	}

	if (existsSync(targetDir)) {
		const stat = statSync(targetDir)
		if (!stat.isDirectory()) {
			console.error(`[create-aero] "${target}" exists and is not a directory.`)
			process.exit(1)
		}
		const files = readdirSync(targetDir)
		if (files.length > 0) {
			console.error(`[create-aero] directory "${target}" already exists and is not empty.`)
			process.exit(1)
		}
	}

	const templatePath = resolveTemplatePath(template)
	let coreVersion = null
	if (!inMonorepo) {
		try {
			const cliPkg = JSON.parse(readFileSync(join(startPkgDir, 'package.json'), 'utf8'))
			coreVersion = cliPkg.version || null
		} catch {
			// ignore; lib will fall back to *
		}
	}
	console.log('')
	console.log('┌─────────────────────────────────────────────┐')
	console.log('│  Aero — HTML-first static sites with Vite  │')
	console.log('└─────────────────────────────────────────────┘')
	console.log('')
	console.log(`[create-aero] Scaffolding "${target}" from template "${template}"…`)
	copyTemplate(templatePath, targetDir)
	rewritePackageJson(templatePath, targetDir, target, inMonorepo, coreVersion)
	writeReadme(targetDir, target, template)
	console.log('[create-aero] Installing dependencies…')
	if (inMonorepo) {
		installInMonorepo(targetDir)
	} else {
		installStandalone(targetDir)
	}
	console.log('')
	console.log('[create-aero] Done. Next steps:')
	console.log(`  1. cd ${inMonorepo ? relative(process.cwd(), targetDir) || targetDir : target}`)
	console.log('  2. pnpm dev          # start the dev server')
	console.log('  3. pnpm build        # production build')
	if (template === 'fullstack') {
		console.log('  4. pnpm preview:api  # preview the built Nitro server')
		console.log('  5. Install the "Aero" VS Code extension for template diagnostics')
	} else {
		console.log('  4. Install the "Aero" VS Code extension for template diagnostics')
	}
	console.log('')
	console.log('  Docs: https://github.com/jamiewilson/aero')
	if (strict) {
		console.log('')
		console.log('[create-aero] Running optional checks (--strict)…')
		runOptionalStrictChecks(targetDir, inMonorepo)
	}
	console.log('')
}

main()
