#!/usr/bin/env node

import { cpSync, mkdirSync, existsSync, statSync, readdirSync, lstatSync } from 'fs'
import { dirname, join, basename } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'
import { parseArgs, rewritePackageJson, writeReadme, findWorkspaceRoot } from './lib.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const startPkgDir = __dirname
const APPS_DIR = 'dist'

const TEMPLATES = ['minimal']
const DEFAULT_TEMPLATE = 'minimal'

function resolveTemplatePath(templateName) {
	const pkgName = `@aerobuilt/template-${templateName}`
	try {
		const pkgUrl = import.meta.resolve(`${pkgName}/package.json`)
		const templatePath = dirname(fileURLToPath(pkgUrl))
		return templatePath
	} catch (e) {
		console.error(`create-aerobuilt: template "${templateName}" not found.`)
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
		const rootPath = join(startPkgDir, '..', '..')
		return existsSync(join(rootPath, 'pnpm-workspace.yaml'))
	} catch {
		return false
	}
}

function installInMonorepo(targetDir) {
	const root = findWorkspaceRoot(targetDir)
	if (!root) {
		console.error('create-aerobuilt: could not find workspace root (pnpm-workspace.yaml).')
		process.exit(1)
	}
	const r = spawnSync('pnpm', ['install', '--no-frozen-lockfile'], {
		stdio: 'inherit',
		cwd: root,
		shell: true,
	})
	if (r.status !== 0) {
		console.error(
			'create-aerobuilt: pnpm install failed. Run "pnpm install" from the repo root.',
		)
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

	const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: targetDir, shell: true })
	if (r.status !== 0) {
		console.error(
			`create-aerobuilt: ${cmd} install failed. Run "${cmd} install" in the project directory.`,
		)
		process.exit(1)
	}
}

function main() {
	const { target, template } = parseArgs(process.argv)

	if (!target) {
		console.error('create-aerobuilt: missing target directory.')
		console.error('Usage: pnpm run create-aerobuilt <dir>')
		console.error('Example: pnpm run create-aerobuilt my-app')
		process.exit(1)
	}

	if (!TEMPLATES.includes(template)) {
		console.error(
			`create-aerobuilt: unknown template "${template}". Use one of: ${TEMPLATES.join(', ')}`,
		)
		process.exit(1)
	}

	// Run from packages/create-aerobuilt: scaffold into packages/create-aerobuilt/dist/<target>
	const inMonorepo = isInMonorepo()
	const targetDir = inMonorepo
		? join(startPkgDir, APPS_DIR, target)
		: join(process.cwd(), target)

	if (inMonorepo) {
		mkdirSync(join(startPkgDir, APPS_DIR), { recursive: true })
	}

	if (existsSync(targetDir)) {
		const stat = statSync(targetDir)
		if (!stat.isDirectory()) {
			console.error(`create-aerobuilt: "${target}" exists and is not a directory.`)
			process.exit(1)
		}
		const files = readdirSync(targetDir)
		if (files.length > 0) {
			console.error(`create-aerobuilt: directory "${target}" already exists and is not empty.`)
			process.exit(1)
		}
	}

	const templatePath = resolveTemplatePath(template)
	console.log(`Creating Aero app in ${target} from template "${template}"...`)
	copyTemplate(templatePath, targetDir)
	rewritePackageJson(targetDir, target, inMonorepo)
	writeReadme(targetDir, target, template)
	console.log('Installing dependencies...')
	if (inMonorepo) {
		installInMonorepo(targetDir)
	} else {
		installStandalone(targetDir)
	}
	console.log('')
	console.log('Done. Next steps:')
	console.log(`  cd ${targetDir}`)
	console.log('  pnpm dev')
	console.log('')
}

main()
