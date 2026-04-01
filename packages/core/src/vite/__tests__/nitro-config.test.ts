import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	findProjectNitroConfigFile,
	loadProjectNitroConfigDetailed,
	writeGeneratedNitroConfig,
} from '../nitro-config'

const tempDirs: string[] = []

function makeTempDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-nitro-config-'))
	tempDirs.push(dir)
	return dir
}

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop()
		if (dir) fs.rmSync(dir, { recursive: true, force: true })
	}
})

describe('nitro-config helpers', () => {
	it('finds a project nitro config file in the root', () => {
		const root = makeTempDir()
		const filePath = path.join(root, 'nitro.config.ts')
		fs.writeFileSync(filePath, 'export default { routeRules: {} }\n')

		expect(findProjectNitroConfigFile(root)).toBe(filePath)
	})

	it('loads routeRules from a TypeScript nitro config', () => {
		const root = makeTempDir()
		fs.writeFileSync(
			path.join(root, 'nitro.config.ts'),
			`import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
	routeRules: {
		'/admin/**': { headers: { 'x-admin': 'true' } },
	},
})
`
		)

		const result = loadProjectNitroConfigDetailed(root)

		expect(result.ok).toBe(true)
		if (result.ok) {
			expect(result.config.routeRules).toEqual({
				'/admin/**': { headers: { 'x-admin': 'true' } },
			})
		}
	})

	it('generates a standalone nitro config when the project has no nitro.config file', () => {
		const root = makeTempDir()
		const result = writeGeneratedNitroConfig({
			root,
			serverDir: 'server',
			distDir: 'dist',
			apiPrefix: '/api',
			redirects: [{ from: '/legacy', to: '/', status: 301 }],
		})

		expect(result.userConfigFile).toBeNull()
		expect(result.conflictingRedirects).toEqual([])
		expect(result.content).toContain("import { defineNitroConfig } from 'nitro/config'")
		expect(result.content).not.toContain('extends:')
		expect(result.content).toContain('"process.env.AERO_DIST": "\\"dist\\""')
		expect(result.content).toContain('"process.env.AERO_API_PREFIX": "\\"/api\\""')
		expect(result.content).toContain('"/legacy"')
		expect(fs.existsSync(result.filePath)).toBe(true)
	})

	it('composes the user nitro config and normalizes relative Nitro paths', () => {
		const root = makeTempDir()
		fs.writeFileSync(
			path.join(root, 'nitro.config.ts'),
			`export default {
	routeRules: {
		'/legacy': { redirect: { to: '/docs', statusCode: 302 } },
	},
	plugins: ['./plugins/runtime.ts'],
	tasks: {
		'cache:warm': {
			handler: './tasks/cache/warm.ts',
		},
	},
	scanDirs: ['./custom-server'],
}
`
		)
		const warn = vi.fn()

		const result = writeGeneratedNitroConfig({
			root,
			serverDir: 'server',
			distDir: 'build',
			apiPrefix: '/internal-api',
			redirects: [
				{ from: '/legacy', to: '/', status: 301 },
				{ from: '/docs', to: '/guides', status: 302 },
			],
			warn,
		})

		expect(result.userConfigFile).toBe(path.join(root, 'nitro.config.ts'))
		expect(result.conflictingRedirects).toEqual(['/legacy'])
		expect(result.content).toContain('...userNitroConfigObject')
		expect(result.content).not.toContain('extends: "../nitro.config.ts"')
		expect(result.content).toContain(path.join(root, 'plugins', 'runtime.ts').replace(/\\/g, '/'))
		expect(result.content).toContain(
			path.join(root, 'tasks', 'cache', 'warm.ts').replace(/\\/g, '/')
		)
		expect(result.content).toContain(path.join(root, 'custom-server').replace(/\\/g, '/'))
		expect(result.content).not.toContain('"/legacy":')
		expect(result.content).toContain('"/docs":')
		expect(warn).toHaveBeenCalledOnce()
	})
})
