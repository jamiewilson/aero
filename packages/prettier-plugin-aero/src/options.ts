import type { SupportOption } from 'prettier'
import type { BuildDirectivePrefixMode } from '@aero-js/compiler/build-directive-attributes'

export type AeroExpressionFormatting = 'full' | 'spacing-only' | 'off'

export interface AeroPluginOptions {
	aeroAttributePrefix: BuildDirectivePrefixMode
	aeroBracketSpacing: boolean
	aeroSelfClosingComponents: boolean
	aeroExpressionFormatting: AeroExpressionFormatting
}

export const defaultAeroOptions: AeroPluginOptions = {
	aeroAttributePrefix: 'none',
	aeroBracketSpacing: true,
	aeroSelfClosingComponents: true,
	aeroExpressionFormatting: 'full',
}

export const aeroOptions: Record<keyof AeroPluginOptions, SupportOption> = {
	aeroAttributePrefix: {
		type: 'choice',
		category: 'Aero',
		default: 'none',
		description: 'Prefix form for Aero build directives.',
		choices: [
			{ value: 'none', description: 'Bare names (props, for, if, …).' },
			{ value: 'aero', description: 'aero-* names (aero-props, aero-for, …).' },
			{ value: 'data-aero', description: 'data-aero-* names (data-aero-props, …).' },
		],
	},
	aeroBracketSpacing: {
		type: 'boolean',
		category: 'Aero',
		default: true,
		description: 'Add spaces inside Aero template braces ({ expr } vs {expr}).',
	},
	aeroSelfClosingComponents: {
		type: 'boolean',
		category: 'Aero',
		default: true,
		description: 'Prefer self-closing tags for *-component elements without children.',
	},
	aeroExpressionFormatting: {
		type: 'choice',
		category: 'Aero',
		default: 'full',
		description:
			'How to format expressions inside { } regions: full Prettier (default), spacing-only, or off.',
		choices: [
			{ value: 'full', description: 'Format inner expressions with Prettier (babel-ts).' },
			{ value: 'spacing-only', description: 'Only adjust { expr } spacing; skip inner formatting.' },
			{ value: 'off', description: 'Do not modify { } regions.' },
		],
	},
}

export function resolveAeroOptions(options: Partial<AeroPluginOptions>): AeroPluginOptions {
	return {
		aeroAttributePrefix: options.aeroAttributePrefix ?? defaultAeroOptions.aeroAttributePrefix,
		aeroBracketSpacing: options.aeroBracketSpacing ?? defaultAeroOptions.aeroBracketSpacing,
		aeroSelfClosingComponents:
			options.aeroSelfClosingComponents ?? defaultAeroOptions.aeroSelfClosingComponents,
		aeroExpressionFormatting:
			options.aeroExpressionFormatting ?? defaultAeroOptions.aeroExpressionFormatting,
	}
}
