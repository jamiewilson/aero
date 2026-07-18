/**
 * Cross-surface scenarios for `aeroAttributePrefix` coverage across author attribute families.
 */

export interface AuthorAttributePrefixScenario {
	readonly id: string
	readonly description: string
	readonly html: string
	readonly prettier: {
		readonly aeroAttributePrefix: 'none' | 'aero' | 'strict'
		readonly mustContain: readonly string[]
		readonly mustNotContain?: readonly string[]
	}
	/** When set, `parse` + `compile` must succeed (recognition of prefixed forms). */
	readonly compileWithPrefix?: {
		readonly html: string
		readonly needsState?: boolean
	}
}

export const AUTHOR_ATTRIBUTE_PREFIX_SCENARIOS: readonly AuthorAttributePrefixScenario[] = [
	{
		id: 'build-if-props',
		description: 'Build directives rewrite between prefix modes',
		html: '<div if="{ ok }" props="{ title }"></div>',
		prettier: {
			aeroAttributePrefix: 'aero',
			mustContain: ['aero-if="{ ok }"', 'aero-props="{ title }"'],
		},
	},
	{
		id: 'runtime-show-text',
		description: 'Simple runtime directives rewrite',
		html: '<div show="{ open }" text="{ label }"></div>',
		prettier: {
			aeroAttributePrefix: 'strict',
			mustContain: ['data-aero-show="{ open }"', 'data-aero-text="{ label }"'],
		},
		compileWithPrefix: {
			needsState: true,
			html: `<script data-aero-is-state>
				let open = true
				let label = 'x'
			</script>
			<div data-aero-show="{ open }" data-aero-text="{ label }"></div>`,
		},
	},
	{
		id: 'event-on-click',
		description: 'Event directives keep colons in aero mode and hyphenate in data-aero',
		html: '<button on:click="{ count++ }"></button>',
		prettier: {
			aeroAttributePrefix: 'aero',
			mustContain: ['aero-on:click="{ count++ }"'],
		},
	},
	{
		id: 'event-data-aero-hyphen',
		description: 'data-aero mode hyphenates on:submit.prevent',
		html: '<form on:submit.prevent="{ save() }"></form>',
		prettier: {
			aeroAttributePrefix: 'strict',
			mustContain: ['data-aero-on-submit-prevent="{ save() }"'],
		},
	},
	{
		id: 'class-toggle',
		description: 'class:* rewrites across modes',
		html: '<button class:is-active="{ active }"></button>',
		prettier: {
			aeroAttributePrefix: 'aero',
			mustContain: ['aero-class:is-active="{ active }"'],
		},
	},
	{
		id: 'bind-count',
		description: 'bind:* rewrites to data-aero-bind-*',
		html: '<counter-component bind:count="{ count }" />',
		prettier: {
			aeroAttributePrefix: 'strict',
			mustContain: ['data-aero-bind-count="{ count }"'],
		},
	},
	{
		id: 'script-is-state',
		description: 'Script taxonomy rewrites with mode spelling rules',
		html: '<script is:state>let count = 0</script>',
		prettier: {
			aeroAttributePrefix: 'strict',
			mustContain: ['<script data-aero-is-state>'],
		},
		compileWithPrefix: {
			needsState: true,
			html: '<script data-aero-is-state>let count = 0</script><p>{ count }</p>',
		},
	},
	{
		id: 'key-attr',
		description: 'key rewrites to aero-key',
		html: '<li key="{ item.id }"></li>',
		prettier: {
			aeroAttributePrefix: 'aero',
			mustContain: ['aero-key="{ item.id }"'],
		},
	},
	{
		id: 'native-for-untouched',
		description: 'Native for stays unprefixed',
		html: '<label for="email">Email</label>',
		prettier: {
			aeroAttributePrefix: 'aero',
			mustContain: ['for="email"'],
			mustNotContain: ['aero-for'],
		},
	},
]
