#!/usr/bin/env node
/**
 * Copy a bundled starter template and run `vp build` (standalone smoke).
 * Usage: node scripts/smoke-template-build.mjs [minimal|fullstack]
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const template = process.argv[2] ?? 'minimal'
if (template !== 'minimal' && template !== 'fullstack') {
	console.error('Usage: node scripts/smoke-template-build.mjs [minimal|fullstack]')
	process.exit(1)
}

const SKIP_DIR = new Set(['node_modules', 'dist', '.output', '.vite', '.aero', '.nitro'])

const root = process.cwd()
const src = join(root, 'packages/create/templates', template)
const dir = mkdtempSync(join(tmpdir(), `aero-template-${template}-`))

/** Drop unpublished devDeps so standalone `pnpm install` matches registry users. */
function prepareStandalonePackage(packageJsonPath) {
	const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
	delete pkg.devDependencies?.['@aero-js/prettier-plugin-aero']
	writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, '\t')}\n`)
}

try {
	cpSync(src, dir, {
		recursive: true,
		filter: (_src, dest) => {
			const base = dest.split(/[/\\]/).pop()
			return !SKIP_DIR.has(base)
		},
	})
	prepareStandalonePackage(join(dir, 'package.json'))
	const env = template === 'fullstack' ? { ...process.env, AERO_SERVER: 'false' } : process.env
	const install = spawnSync('pnpm', ['install'], { cwd: dir, stdio: 'inherit', shell: true })
	if (install.status !== 0) process.exit(install.status ?? 1)
	const build = spawnSync('pnpm', ['exec', 'vp', 'build'], {
		cwd: dir,
		stdio: 'inherit',
		shell: true,
		env,
	})
	process.exit(build.status ?? 1)
} finally {
	rmSync(dir, { recursive: true, force: true })
}
