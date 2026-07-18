/**
 * Cross-surface diagnostic parity scenarios (compiler / IDE / CLI).
 */

export type ParitySurface = 'compiler' | 'ide' | 'cli'

/** @deprecated Use {@link ParitySurface} `ide`. */
export type LegacyParitySurface = 'vscode'

export type ParityCategory =
	| 'feature-gates'
	| 'reactive-scope'
	| 'structural'
	| 'state-script'
	| 'directive-braces'
	| 'hypermedia'
	| 'component'
	| 'warnings'
	| 'route'

export interface ParityExpectation {
	readonly code: string
	readonly messageIncludes: string
	readonly severity?: 'error' | 'warning'
}

export interface ParityScenario {
	readonly id: string
	readonly ruleId: string
	readonly category: ParityCategory
	readonly description: string
	readonly html: string
	readonly flags: { readonly reactivity: boolean; readonly hypermedia: boolean }
	readonly surfaces: Partial<Record<ParitySurface | LegacyParitySurface, ParityExpectation>>
}

function surfaces(
	expectation: ParityExpectation,
	which: readonly (ParitySurface | LegacyParitySurface)[] = ['compiler', 'ide', 'cli']
): ParityScenario['surfaces'] {
	const out: ParityScenario['surfaces'] = {}
	for (const surface of which) out[surface] = expectation
	// Keep vscode alias in sync with ide for older runners during migration.
	if (which.includes('ide') && !which.includes('vscode')) {
		out.vscode = expectation
	}
	return out
}

export const PARITY_SCENARIOS: readonly ParityScenario[] = [
	{
		id: 'is-state-without-reactivity',
		ruleId: 'feature-gate.is-state-requires-reactivity',
		category: 'feature-gates',
		description: '`<script is:state>` requires `reactivity: true`',
		html: '<script is:state>let count = 0</script><p>{ count }</p>',
		flags: { reactivity: false, hypermedia: false },
		surfaces: surfaces({
			code: 'AERO_CONFIG',
			messageIncludes: '`<script is:state>` requires `reactivity: true`',
		}),
	},
	{
		id: 'busy-without-flags',
		ruleId: 'feature-gate.busy-requires-flags',
		category: 'feature-gates',
		description: '`busy` requires both reactivity and hypermedia flags',
		html: '<button busy="{ isSaving }">Save</button>',
		flags: { reactivity: false, hypermedia: false },
		surfaces: surfaces({
			code: 'AERO_CONFIG',
			messageIncludes: '`busy` requires both `reactivity: true` and `hypermedia: true`',
		}),
	},
	{
		id: 'hypermedia-action-without-hypermedia',
		ruleId: 'feature-gate.action-requires-hypermedia',
		category: 'feature-gates',
		description: 'Hypermedia action calls require `hypermedia: true`',
		html: `<script is:state>
	let label = 'Items'
</script>
<button on:click="{ GET('/api/items') }">{ label }</button>`,
		flags: { reactivity: true, hypermedia: false },
		surfaces: surfaces(
			{
				code: 'AERO_CONFIG',
				messageIncludes: 'Hypermedia action calls require `hypermedia: true`',
			},
			['compiler', 'ide']
		),
	},
	{
		id: 'malformed-props-braces',
		ruleId: 'directive-braces.props',
		category: 'directive-braces',
		description: 'Directive props must use braced expression',
		html: '<div props="not-braced">x</div>',
		flags: { reactivity: false, hypermedia: false },
		surfaces: surfaces({
			code: 'AERO_COMPILE',
			messageIncludes: 'Directive `props`',
		}),
	},
	{
		id: 'malformed-class-binding-braces',
		ruleId: 'directive-braces.runtime-class',
		category: 'directive-braces',
		description: 'Reactive class:* with a value must use braced expression',
		html: `<script is:state>
	let count = 0
</script>
<div class:is-active="true"></div>`,
		flags: { reactivity: true, hypermedia: false },
		surfaces: surfaces(
			{
				code: 'AERO_COMPILE',
				messageIncludes: 'Directive `class:is-active`',
			},
			['compiler', 'ide']
		),
	},
	{
		id: 'empty-class-binding-braces',
		ruleId: 'directive-braces.runtime-class',
		category: 'directive-braces',
		description: 'Empty class:*="" must use braced expression (not bare shorthand)',
		html: `<script is:state>
	let isActive = false
</script>
<div class:is-active=""></div>`,
		flags: { reactivity: true, hypermedia: false },
		surfaces: surfaces(
			{
				code: 'AERO_COMPILE',
				messageIncludes: 'must use a braced expression',
			},
			['compiler', 'ide']
		),
	},
	{
		id: 'malformed-show-braces',
		ruleId: 'directive-braces.show',
		category: 'directive-braces',
		description: 'Reactive show must use braced expression',
		html: `<script is:state>
	let open = false
</script>
<div show="open"></div>`,
		flags: { reactivity: true, hypermedia: false },
		surfaces: surfaces(
			{
				code: 'AERO_COMPILE',
				messageIncludes: 'Directive `show`',
			},
			['compiler', 'ide']
		),
	},
	{
		id: 'malformed-html-braces',
		ruleId: 'directive-braces.html',
		category: 'directive-braces',
		description: 'Reactive html must use braced expression',
		html: `<script is:state>
	let markup = '<b>x</b>'
</script>
<div html="markup"></div>`,
		flags: { reactivity: true, hypermedia: false },
		surfaces: surfaces(
			{
				code: 'AERO_COMPILE',
				messageIncludes: 'Directive `html`',
			},
			['compiler', 'ide']
		),
	},
	{
		id: 'hypermedia-string-state-option',
		ruleId: 'hypermedia.action-state-must-be-binding',
		category: 'hypermedia',
		description: 'Action state option must be signal ref, not string',
		html: `<script is:state>
	let isSaving = false
</script>
<button on:click="{ POST('/api/save', { state: 'isSaving' }) }">Save</button>`,
		flags: { reactivity: true, hypermedia: true },
		surfaces: surfaces({
			code: 'AERO_CONFIG',
			messageIncludes: 'Hypermedia action `state` must reference a boolean state binding',
		}),
	},
	{
		id: 'reactive-class-undeclared-state',
		ruleId: 'reactive-scope.class-binding-state-ref',
		category: 'reactive-scope',
		description: 'Reactive class binding must reference a declared state variable',
		html: `<script is:state>
	let count = 0
</script>
<div class:is-active="{ isActive }"></div>`,
		flags: { reactivity: true, hypermedia: false },
		surfaces: surfaces(
			{
				code: 'AERO_COMPILE',
				messageIncludes: 'Reactive class binding `class:is-active` must reference a declared state variable',
			},
			['compiler', 'ide']
		),
	},
	{
		id: 'reactive-event-unknown-name',
		ruleId: 'reactive-scope.unknown-name-in-handler',
		category: 'reactive-scope',
		description: 'Unknown name in on:* handler',
		html: `<script is:state>
	let items = []
</script>
<button on:click="{ add() }">Add</button>`,
		flags: { reactivity: true, hypermedia: false },
		surfaces: surfaces(
			{
				code: 'AERO_COMPILE',
				messageIncludes: 'Unknown name `add`',
			},
			['compiler', 'ide']
		),
	},
	{
		id: 'switch-orphan-child',
		ruleId: 'structural.switch-direct-children',
		category: 'structural',
		description: 'Switch container may only contain case/default branches',
		html: `<div switch="{ mode }">
	<p>orphan</p>
</div>`,
		flags: { reactivity: false, hypermedia: false },
		surfaces: {
			compiler: {
				code: 'AERO_COMPILE',
				messageIncludes: 'case` / `default`',
			},
			// Intentional: IDE does not yet validate switch structure (see matrix).
		},
	},
	{
		id: 'orphaned-else',
		ruleId: 'structural.orphaned-else',
		category: 'structural',
		description: 'Orphaned else without preceding if',
		html: `<p else>x</p>`,
		flags: { reactivity: false, hypermedia: false },
		surfaces: {
			ide: {
				code: 'AERO_COMPILE',
				messageIncludes: 'else must follow an element with if or else-if',
			},
			vscode: {
				code: 'AERO_COMPILE',
				messageIncludes: 'else must follow an element with if or else-if',
			},
			// Intentional: compile currently strips orphaned else silently (see matrix).
		},
	},
]

export interface RouteParityScenario {
	readonly id: string
	readonly description: string
	readonly files: Readonly<Record<string, string>>
	readonly expectCode: string
	readonly messageIncludes: string
}

export const ROUTE_PARITY_SCENARIOS: readonly RouteParityScenario[] = [
	{
		id: 'unsupported-route-segment',
		description: 'Unsupported route segment syntax',
		files: { 'client/pages/docs/[...slug].html': '<p>x</p>\n' },
		expectCode: 'AERO_ROUTE',
		messageIncludes: 'Unsupported route segment',
	},
]
