import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const pluginSchemaPath = join(here, '../../schema.json')
const vscodeSchemaPath = join(here, '../../../vscode/schemas/prettierrc-aero.json')

describe('prettier config schema', () => {
	it('documents Aero plugin options for editor autocomplete', () => {
		const schema = JSON.parse(readFileSync(pluginSchemaPath, 'utf8')) as {
			definitions: Record<string, unknown>
			properties: Record<string, unknown>
		}

		expect(schema.definitions).toMatchObject({
			aeroAttributePrefix: expect.any(Object),
			aeroBracketSpacing: expect.any(Object),
			aeroSelfClosingComponents: expect.any(Object),
			aeroOptions: expect.any(Object),
		})
		expect(schema.properties).toMatchObject({
			aeroAttributePrefix: expect.any(Object),
			aeroBracketSpacing: expect.any(Object),
			aeroSelfClosingComponents: expect.any(Object),
			overrides: expect.any(Object),
		})
		expect(schema.definitions.aeroAttributePrefix).toMatchObject({
			enum: ['none', 'aero', 'data-aero'],
			default: 'none',
		})
	})

	it('stays in sync with the VS Code extension copy', () => {
		const pluginSchema = readFileSync(pluginSchemaPath, 'utf8')
		const vscodeSchema = readFileSync(vscodeSchemaPath, 'utf8')
		expect(vscodeSchema).toBe(pluginSchema)
	})
})
