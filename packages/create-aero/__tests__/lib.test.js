import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { parseArgs, rewritePackageJson, writeReadme, findWorkspaceRoot } from '../lib.js'

describe('create-aero lib', () => {
	describe('parseArgs', () => {
		it('returns target as first positional and default template', () => {
			expect(parseArgs(['node', 'index.js', 'my-app'])).toEqual({
				target: 'my-app',
				template: 'minimal',
			})
		})

		it('returns template when --template is given', () => {
			expect(parseArgs(['node', 'index.js', 'my-app', '--template', 'minimal'])).toEqual({
				target: 'my-app',
				template: 'minimal',
			})
		})

		it('allows template before target', () => {
			expect(parseArgs(['node', 'index.js', '--template', 'minimal', 'my-app'])).toEqual({
				target: 'my-app',
				template: 'minimal',
			})
		})

		it('returns null target when no positional given', () => {
			expect(parseArgs(['node', 'index.js'])).toEqual({ target: null, template: 'minimal' })
		})

		it('ignores unknown flags and uses first positional as target', () => {
			expect(parseArgs(['node', 'index.js', '--foo', 'my-app'])).toEqual({
				target: 'my-app',
				template: 'minimal',
			})
		})
	})

	describe('rewritePackageJson', () => {
		/** @type {string} */
		let tmpDir

		beforeEach(() => {
			tmpDir = mkdtempSync(join(tmpdir(), 'create-aero-test-'))
		})

		afterEach(() => {
			rmSync(tmpDir, { recursive: true, force: true })
		})

		it('sets name to projectName', () => {
			writeFileSync(
				join(tmpDir, 'package.json'),
				JSON.stringify({ name: '@aerobuilt/template-minimal', dependencies: {} }),
			)
			rewritePackageJson(tmpDir, 'my-app', true)
			const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf8'))
			expect(pkg.name).toBe('my-app')
		})

		it('when inMonorepo true, leaves workspace:* unchanged', () => {
			writeFileSync(
				join(tmpDir, 'package.json'),
				JSON.stringify({
					name: 'template',
					dependencies: { '@aerobuilt/core': 'workspace:*' },
				}),
			)
			rewritePackageJson(tmpDir, 'my-app', true)
			const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf8'))
			expect(pkg.dependencies['@aerobuilt/core']).toBe('workspace:*')
		})

		it('when inMonorepo false, rewrites workspace:* to *', () => {
			writeFileSync(
				join(tmpDir, 'package.json'),
				JSON.stringify({
					name: 'template',
					dependencies: { '@aerobuilt/core': 'workspace:*' },
					devDependencies: { vite: '^1.0.0' },
				}),
			)
			rewritePackageJson(tmpDir, 'my-app', false)
			const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf8'))
			expect(pkg.name).toBe('my-app')
			expect(pkg.dependencies['@aerobuilt/core']).toBe('*')
			expect(pkg.devDependencies.vite).toBe('^1.0.0')
		})

		it('does nothing when package.json does not exist', () => {
			rewritePackageJson(tmpDir, 'my-app', false)
			expect(existsSync(join(tmpDir, 'package.json'))).toBe(false)
		})
	})

	describe('findWorkspaceRoot', () => {
		/** @type {string} */
		let tmpDir

		beforeEach(() => {
			tmpDir = mkdtempSync(join(tmpdir(), 'create-aero-ws-'))
		})

		afterEach(() => {
			rmSync(tmpDir, { recursive: true, force: true })
		})

		it('returns dir when pnpm-workspace.yaml is in that dir', () => {
			writeFileSync(join(tmpDir, 'pnpm-workspace.yaml'), 'packages: []')
			expect(findWorkspaceRoot(tmpDir)).toBe(tmpDir)
		})

		it('returns parent dir when pnpm-workspace.yaml is in parent', () => {
			writeFileSync(join(tmpDir, 'pnpm-workspace.yaml'), 'packages: []')
			const child = join(tmpDir, 'packages', 'start')
			mkdirSync(child, { recursive: true })
			expect(findWorkspaceRoot(child)).toBe(tmpDir)
		})

		it('returns null when no pnpm-workspace.yaml found', () => {
			expect(findWorkspaceRoot(tmpDir)).toBe(null)
		})
	})

	describe('writeReadme', () => {
		/** @type {string} */
		let tmpDir

		beforeEach(() => {
			tmpDir = mkdtempSync(join(tmpdir(), 'create-aero-readme-'))
		})

		afterEach(() => {
			rmSync(tmpDir, { recursive: true, force: true })
		})

		it('writes README with project name as title', () => {
			writeReadme(tmpDir, 'my-app', 'minimal')
			const readme = readFileSync(join(tmpDir, 'README.md'), 'utf8')
			expect(readme).toMatch(/^# my-app/)
			expect(readme).toContain('pnpm dev')
			expect(readme).toContain('pnpm build')
		})

		it('does not include Nitro commands for minimal template', () => {
			writeReadme(tmpDir, 'my-app', 'minimal')
			const readme = readFileSync(join(tmpDir, 'README.md'), 'utf8')
			expect(readme).not.toContain('preview:api')
			expect(readme).not.toContain('server/api')
		})
	})
})
