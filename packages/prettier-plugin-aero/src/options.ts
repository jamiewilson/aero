import type { SupportOption } from 'prettier'

export interface AeroPluginOptions {
	aeroAttributePrefix: boolean
	aeroBracketSpacing: boolean
	aeroSelfClosingComponents: boolean
}

export const defaultAeroOptions: AeroPluginOptions = {
	aeroAttributePrefix: false,
	aeroBracketSpacing: true,
	aeroSelfClosingComponents: true,
}

export const aeroOptions: Record<keyof AeroPluginOptions, SupportOption> = {
	aeroAttributePrefix: {
		type: 'boolean',
		category: 'Aero',
		default: false,
		description: 'Use data- prefix on Aero build directives (data-props vs props).',
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
