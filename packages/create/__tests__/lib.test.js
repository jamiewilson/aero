import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { parseArgs, rewritePackageJson, writeReadme, findWorkspaceRoot } from '../lib.js'

describe('@aero-js/create lib', () => {
	describe('parseArgs', () => {
		it('returns target as first positional and default template', () => {
			expect(parseArgs(['node', 'index.js', 'my-app'])).toEqual({
				target: 'my-app',
				template: 'minimal',
				strict: false,
			})
		})

		it('returns template when --template is given', () => {
			expect(parseArgs(['node', 'index.js', 'my-app', '--template', 'minimal'])).toEqual({
				target: 'my-app',
				template: 'minimal',
				strict: false,
			})
		})

		it('allows template before target', () => {
			expect(parseArgs(['node', 'index.js', '--template', 'minimal', 'my-app'])).toEqual({
				target: 'my-app',
				template: 'minimal',
				strict: false,
			})
		})

		it('sets strict when --strict is passed', () => {
			expect(parseArgs(['node', 'index.js', '--strict', 'my-app'])).toEqual({
				target: 'my-app',
				template: 'minimal',
				strict: true,
			})
		})

		it('returns null target when no positional given', () => {
			expect(parseArgs(['node', 'index.js'])).toEqual({
				target: null,
				template: 'minimal',
				strict: false,
			})
		})

		it('ignores unknown flags and uses first positional as target', () => {
			expect(parseArgs(['node', 'index.js', '--foo', 'my-app'])).toEqual({
				target: 'my-app',
				template: 'minimal',
				strict: false,
			})
		})
	})

	describe('rewritePackageJson', () => {
		/** @type {string} */
		let templateDir
		/** @type {string} */
		let targetDir

		beforeEach(() => {
			templateDir = mkdtempSync(join(tmpdir(), 'create-template-'))
			targetDir = mkdtempSync(join(tmpdir(), 'create-target-'))
		})

		afterEach(() => {
			rmSync(templateDir, { recursive: true, force: true })
			rmSync(targetDir, { recursive: true, force: true })
		})

		it('writes package.json from package-template.json with name and version', () => {
			writeFileSync(
				join(templateDir, 'package-template.json'),
				JSON.stringify({
					name: '<name>',
					version: '0.1.0',
					type: 'module',
					scripts: { dev: 'vite dev' },
					dependencies: { '@aero-js/core': '<version>' },
					devDependencies: { vite: '8.0.2' },
				})
			)
			rewritePackageJson(templateDir, targetDir, 'my-app', true)
			const pkg = JSON.parse(readFileSync(join(targetDir, 'package.json'), 'utf8'))
			expect(pkg.name).toBe('my-app')
			expect(pkg.version).toBe('0.1.0')
			expect(pkg.type).toBe('module')
		})

		it('when inMonorepo true, sets @aero-js/core to workspace:*', () => {
			writeFileSync(
				join(templateDir, 'package-template.json'),
				JSON.stringify({
					name: '<name>',
					version: '0.1.0',
					dependencies: { '@aero-js/core': '<version>' },
				})
			)
			rewritePackageJson(templateDir, targetDir, 'my-app', true)
			const pkg = JSON.parse(readFileSync(join(targetDir, 'package.json'), 'utf8'))
			expect(pkg.dependencies['@aero-js/core']).toBe('workspace:*')
		})

		it('when inMonorepo false and no version, sets @aero-js/core to *', () => {
			writeFileSync(
				join(templateDir, 'package-template.json'),
				JSON.stringify({
					name: '<name>',
					version: '0.1.0',
					dependencies: { '@aero-js/core': '<version>' },
					devDependencies: { vite: '^1.0.0' },
				})
			)
			rewritePackageJson(templateDir, targetDir, 'my-app', false)
			const pkg = JSON.parse(readFileSync(join(targetDir, 'package.json'), 'utf8'))
			expect(pkg.name).toBe('my-app')
			expect(pkg.dependencies['@aero-js/core']).toBe('*')
			expect(pkg.devDependencies.vite).toBe('^1.0.0')
		})

		it('when inMonorepo false and coreVersion given, sets @aero-js/core to ^version', () => {
			writeFileSync(
				join(templateDir, 'package-template.json'),
				JSON.stringify({
					name: '<name>',
					version: '0.1.0',
					dependencies: { '@aero-js/core': '<version>' },
				})
			)
			rewritePackageJson(templateDir, targetDir, 'my-app', false, '0.2.9')
			const pkg = JSON.parse(readFileSync(join(targetDir, 'package.json'), 'utf8'))
			expect(pkg.dependencies['@aero-js/core']).toBe('^0.2.9')
		})

		it('exits when package-template.json is missing', () => {
			const exit = process.exit
			try {
				process.exit = /** @type {typeof process.exit} */ (
					code => {
						throw new Error(`exit(${code})`)
					}
				)
				expect(() => rewritePackageJson(templateDir, targetDir, 'my-app', false)).toThrow('exit(1)')
			} finally {
				process.exit = exit
			}
		})
	})

	describe('findWorkspaceRoot', () => {
		/** @type {string} */
		let tmpDir

		beforeEach(() => {
			tmpDir = mkdtempSync(join(tmpdir(), 'create-aero-js-ws-'))
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
			tmpDir = mkdtempSync(join(tmpdir(), 'create-aero-js-readme-'))
		})

		afterEach(() => {
			rmSync(tmpDir, { recursive: true, force: true })
		})

		it('writes README with project name as title', () => {
			writeReadme(tmpDir, 'my-app')
			const readme = readFileSync(join(tmpDir, 'README.md'), 'utf8')
			expect(readme).toMatch(/^# my-app/)
			expect(readme).toContain('pnpm dev')
			expect(readme).toContain('pnpm build')
		})

		it('does not include Nitro commands for minimal template', () => {
			writeReadme(tmpDir, 'my-app')
			const readme = readFileSync(join(tmpDir, 'README.md'), 'utf8')
			expect(readme).not.toContain('preview:api')
			expect(readme).not.toContain('server/api')
		})
	})
})
