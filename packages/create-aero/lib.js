import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

const DEFAULT_TEMPLATE = 'minimal'

/**
 * Parse CLI argv into { target, template }.
 * @param {string[]} argv - process.argv
 * @returns {{ target: string | null, template: string }}
 */
export function parseArgs(argv) {
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

/**
 * Rewrite package.json in targetDir: set name to projectName; if !inMonorepo, replace workspace:* with *.
 * @param {string} targetDir
 * @param {string} projectName
 * @param {boolean} inMonorepo
 */
export function rewritePackageJson(targetDir, projectName, inMonorepo) {
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

/**
 * Walk up from fromDir to find directory containing pnpm-workspace.yaml.
 * @param {string} fromDir
 * @returns {string | null}
 */
export function findWorkspaceRoot(fromDir) {
	let dir = fromDir
	for (;;) {
		if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
		const parent = dirname(dir)
		if (parent === dir) return null
		dir = parent
	}
}
