#!/usr/bin/env node

import {
	cpSync,
	mkdirSync,
	existsSync,
	statSync,
	readdirSync,
	readFileSync,
	writeFileSync,
	lstatSync,
} from 'fs'
import { dirname, join, basename } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const startPkgDir = __dirname
const pkgRoot = join(startPkgDir, 'node_modules')
const APPS_DIR = 'dist'

const TEMPLATES = ['minimal', 'kitchen-sink']
const DEFAULT_TEMPLATE = 'minimal'

function parseArgs(argv) {
	const args = argv.slice(2)
	let target = null
	let template = DEFAULT_TEMPLATE
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--template' && args[i + 1]) {
			template = args[++i]
			continue
		}
		if (!args[i].startsWith('-') && !target) {
			target = args[i]
		}
	}
	return { target, template }
}

function resolveTemplatePath(templateName) {
	const pkgName = `@aero-ssg/template-${templateName}`
	const templatePath = join(pkgRoot, pkgName)
	if (!existsSync(templatePath)) {
		console.error(
			`create-aero: template "${templateName}" not found (expected ${templatePath}).`,
		)
		console.error('Install dependencies with: pnpm install')
		process.exit(1)
	}
	return templatePath
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
		const templatePath = join(pkgRoot, `@aero-ssg/template-${DEFAULT_TEMPLATE}`)
		if (!existsSync(templatePath)) return false
		return lstatSync(templatePath).isSymbolicLink()
	} catch {
		return false
	}
}

function rewritePackageJson(targetDir, projectName, inMonorepo) {
	const pkgPath = join(targetDir, 'package.json')
	if (!existsSync(pkgPath)) return
	const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
	pkg.name = projectName
	if (!inMonorepo) {
		const rewrite = deps => {
			if (!deps) return
			for (const key of Object.keys(deps)) {
				if (deps[key] === 'workspace:*') deps[key] = '*'
			}
		}
		rewrite(pkg.dependencies)
		rewrite(pkg.devDependencies)
	}
	writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

function findWorkspaceRoot(fromDir) {
	let dir = fromDir
	for (;;) {
		if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
		const parent = dirname(dir)
		if (parent === dir) return null
		dir = parent
	}
}

function installInMonorepo(targetDir) {
	const root = findWorkspaceRoot(targetDir)
	if (!root) {
		console.error('create-aero: could not find workspace root (pnpm-workspace.yaml).')
		process.exit(1)
	}
	const r = spawnSync('pnpm', ['install', '--no-frozen-lockfile'], {
		stdio: 'inherit',
		cwd: root,
		shell: true,
	})
	if (r.status !== 0) {
		console.error('create-aero: pnpm install failed. Run "pnpm install" from the repo root.')
		process.exit(1)
	}
}

function installStandalone(targetDir) {
	const hasPnpm = existsSync(join(targetDir, 'pnpm-lock.yaml'))
	const hasNpm = existsSync(join(targetDir, 'package-lock.json'))
	const hasYarn = existsSync(join(targetDir, 'yarn.lock'))
	const cmd = hasPnpm ? 'pnpm' : hasYarn ? 'yarn' : 'npm'
	const args = hasPnpm || hasYarn ? ['install'] : ['install']
	const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: targetDir, shell: true })
	if (r.status !== 0) {
		console.error(
			`create-aero: ${cmd} install failed. Run "${cmd} install" in the project directory.`,
		)
		process.exit(1)
	}
}

function main() {
	const { target, template } = parseArgs(process.argv)

	if (!target) {
		console.error('create-aero: missing target directory.')
		console.error('Usage: pnpm run create-aero <dir> [--template minimal|kitchen-sink]')
		console.error('Example: pnpm run create-aero my-app')
		process.exit(1)
	}

	if (!TEMPLATES.includes(template)) {
		console.error(
			`create-aero: unknown template "${template}". Use one of: ${TEMPLATES.join(', ')}`,
		)
		process.exit(1)
	}

	// Run from packages/start: scaffold into packages/start/dist/<target>
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
			console.error(`create-aero: "${target}" exists and is not a directory.`)
			process.exit(1)
		}
		const files = readdirSync(targetDir)
		if (files.length > 0) {
			console.error(`create-aero: directory "${target}" already exists and is not empty.`)
			process.exit(1)
		}
	}

	const templatePath = resolveTemplatePath(template)
	console.log(`Creating Aero app in ${target} from template "${template}"...`)
	copyTemplate(templatePath, targetDir)
	rewritePackageJson(targetDir, target, inMonorepo)
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
