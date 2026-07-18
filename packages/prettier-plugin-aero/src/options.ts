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
		description:
			'Prefix form for Aero framework attributes (build directives, show/html/busy/text, on:*, class:*, bind:*, is:*, key).',
		choices: [
			{
				value: 'none',
				description: 'Bare author forms (props, show, on:click, is:build, …).',
			},
			{
				value: 'aero',
				description: 'aero-* ownership prefix; keep colons (aero-on:click, aero-is:build).',
			},
			{
				value: 'strict',
				description:
					'data-aero-* strict HTML names; colons become hyphens (data-aero-on-click, data-aero-is-build).',
			},
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
