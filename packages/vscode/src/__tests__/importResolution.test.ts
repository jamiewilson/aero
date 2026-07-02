import * as path from 'node:path'
import { describe, it, expect } from 'vitest'
import {
	isTemplateAliasSpecifier,
	isValidTemplateImportSpecifier,
	resolveImportToFile,
} from '../importResolution'

const kitchenSink = path.resolve(import.meta.dirname, '../../../../examples/kitchen-sink')

describe('importResolution', () => {
	it('detects template alias specifiers', () => {
		expect(isTemplateAliasSpecifier('@layouts/base')).toBe(true)
		expect(isTemplateAliasSpecifier('@layouts/base.html')).toBe(true)
		expect(isTemplateAliasSpecifier('@content/site')).toBe(false)
	})

	it('requires .html for template alias imports', () => {
		expect(isValidTemplateImportSpecifier('@layouts/base')).toBe(false)
		expect(isValidTemplateImportSpecifier('@layouts/base.html')).toBe(true)
		expect(isValidTemplateImportSpecifier('@scripts/utils')).toBe(false)
	})

	it('resolves directory module imports to index.ts', () => {
		const candidate = path.join(kitchenSink, 'client/assets/scripts/utils')
		expect(resolveImportToFile('@scripts/utils', candidate)).toBe(
			path.join(kitchenSink, 'client/assets/scripts/utils/index.ts')
		)
	})

	it('resolves extensionless module imports to .ts files', () => {
		const candidate = path.join(kitchenSink, 'content/site')
		expect(resolveImportToFile('@content/site', candidate)).toBe(
			path.join(kitchenSink, 'content/site.ts')
		)
	})

	it('does not infer .html for extensionless template alias imports', () => {
		const candidate = path.join(kitchenSink, 'client/layouts/base')
		expect(resolveImportToFile('@layouts/base', candidate)).toBeUndefined()
	})

	it('resolves explicit .html template paths', () => {
		const candidate = path.join(kitchenSink, 'client/layouts/base.html')
		expect(resolveImportToFile('@layouts/base.html', candidate)).toBe(candidate)
	})
})
