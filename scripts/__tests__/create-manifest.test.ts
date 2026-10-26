import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vite-plus/test'

const CREATE_PKG = join(process.cwd(), 'packages/create/package.json')

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
})
