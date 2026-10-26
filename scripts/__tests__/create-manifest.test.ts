import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vite-plus/test'

const CREATE_PKG = join(process.cwd(), 'packages/create/package.json')
const CREATE_ROOT = join(process.cwd(), 'packages/create')

function readTemplateJson(template: 'minimal' | 'fullstack', file: string) {
	return JSON.parse(
		readFileSync(join(CREATE_ROOT, 'templates', template, file), 'utf8')
	) as Record<string, unknown>
}

describe('@aero-js/create manifest', () => {
	it('declares minimal and fullstack templates with bundled paths', () => {
		const pkg = JSON.parse(readFileSync(CREATE_PKG, 'utf8')) as {
			createConfig?: {
				templates: Array<{ name: string; template: string }>
			}
		}
		expect(pkg.createConfig?.templates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'minimal', template: './templates/minimal' }),
				expect.objectContaining({ name: 'fullstack', template: './templates/fullstack' }),
			])
		)
	})

	it.each(['minimal', 'fullstack'] as const)(
		'%s template ships Prettier with @aero-js/prettier-plugin-aero for HTML',
		template => {
			const pkg = readTemplateJson(template, 'package.json') as {
				devDependencies?: Record<string, string>
				scripts?: Record<string, string>
			}
			expect(pkg.devDependencies?.['@aero-js/prettier-plugin-aero']).toBeDefined()
			expect(pkg.devDependencies?.prettier).toBeDefined()
			expect(pkg.scripts?.fmt).toContain('prettier --write')
			expect(pkg.scripts?.['fmt:check']).toContain('prettier --check')

			const prettierrc = readTemplateJson(template, '.prettierrc.json') as {
				plugins?: string[]
				overrides?: Array<{ files: string[]; options: { parser: string } }>
			}
			expect(prettierrc.plugins).toContain('@aero-js/prettier-plugin-aero')
			expect(prettierrc.overrides).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						files: ['**/*.html'],
						options: expect.objectContaining({ parser: 'aero' }),
					}),
				])
			)
		}
	)

	it.each(['minimal', 'fullstack'] as const)(
		'%s template excludes Aero HTML from oxfmt',
		template => {
			const oxfmtrc = readTemplateJson(template, '.oxfmtrc.json') as {
				ignorePatterns?: string[]
			}
			expect(oxfmtrc.ignorePatterns).toContain('**/client/**/*.html')
		}
	)
})
