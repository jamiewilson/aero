#!/usr/bin/env node
/**
 * Copy a bundled starter template and run `vp build` (standalone smoke).
 * Usage: node scripts/smoke-template-build.mjs [minimal|fullstack]
 */
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const template = process.argv[2] ?? 'minimal'
if (template !== 'minimal' && template !== 'fullstack') {
	console.error('Usage: node scripts/smoke-template-build.mjs [minimal|fullstack]')
	process.exit(1)
}

const root = process.cwd()
const src = join(root, 'packages/create/templates', template)
const dir = mkdtempSync(join(tmpdir(), `aero-template-${template}-`))

try {
	cpSync(src, dir, { recursive: true })
	const env =
		template === 'fullstack' ? { ...process.env, AERO_SERVER: 'false' } : process.env
	const install = spawnSync('pnpm', ['install'], { cwd: dir, stdio: 'inherit', shell: true })
	if (install.status !== 0) process.exit(install.status ?? 1)
	const build = spawnSync('pnpm', ['exec', 'vp', 'build'], { cwd: dir, stdio: 'inherit', shell: true, env })
	process.exit(build.status ?? 1)
} finally {
	rmSync(dir, { recursive: true, force: true })
}
