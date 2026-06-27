import type { SupportOption } from 'prettier'
import type { BuildDirectivePrefixMode } from '@aero-js/compiler/build-directive-attributes'

export interface AeroPluginOptions {
	aeroAttributePrefix: BuildDirectivePrefixMode
	aeroBracketSpacing: boolean
	aeroSelfClosingComponents: boolean
}

export const defaultAeroOptions: AeroPluginOptions = {
	aeroAttributePrefix: 'none',
	aeroBracketSpacing: true,
	aeroSelfClosingComponents: true,
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
}

export function resolveAeroOptions(options: Partial<AeroPluginOptions>): AeroPluginOptions {
	return {
		aeroAttributePrefix: options.aeroAttributePrefix ?? defaultAeroOptions.aeroAttributePrefix,
		aeroBracketSpacing: options.aeroBracketSpacing ?? defaultAeroOptions.aeroBracketSpacing,
		aeroSelfClosingComponents:
			options.aeroSelfClosingComponents ?? defaultAeroOptions.aeroSelfClosingComponents,
	}
}
