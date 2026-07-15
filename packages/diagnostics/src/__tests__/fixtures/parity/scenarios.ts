/**
 * Cross-surface diagnostic parity scenarios (compiler, CLI, VSCode).
 * Language server is out of scope for v1 — see parity matrix doc.
 */

export type ParitySurface = 'compiler' | 'cli' | 'vscode'

export interface ParityExpectation {
	readonly code: string
	readonly messageIncludes: string
}

export interface ParityScenario {
	readonly id: string
	readonly description: string
	readonly html: string
	readonly flags: { readonly reactivity: boolean; readonly hypermedia: boolean }
	readonly surfaces: Partial<Record<ParitySurface, ParityExpectation>>
}

export const PARITY_SCENARIOS: readonly ParityScenario[] = [
	{
		id: 'is-state-without-reactivity',
		description: '`<script is:state>` requires `reactivity: true`',
		html: '<script is:state>let count = 0</script><p>{ count }</p>',
		flags: { reactivity: false, hypermedia: false },
		surfaces: {
			compiler: {
				code: 'AERO_CONFIG',
				messageIncludes: '`<script is:state>` requires `reactivity: true`',
			},
			cli: {
				code: 'AERO_CONFIG',
				messageIncludes: '`<script is:state>` requires `reactivity: true`',
			},
			vscode: {
				code: 'AERO_CONFIG',
				messageIncludes: '`<script is:state>` requires `reactivity: true`',
			},
		},
	},
	{
		id: 'busy-without-flags',
		description: '`busy` requires both reactivity and hypermedia flags',
		html: '<button busy="{ isSaving }">Save</button>',
		flags: { reactivity: false, hypermedia: false },
		surfaces: {
			compiler: {
				code: 'AERO_CONFIG',
				messageIncludes: '`busy` requires both `reactivity: true` and `hypermedia: true`',
			},
			cli: {
				code: 'AERO_CONFIG',
				messageIncludes: '`busy` requires both `reactivity: true` and `hypermedia: true`',
			},
			vscode: {
				code: 'AERO_CONFIG',
				messageIncludes: '`busy` requires both `reactivity: true` and `hypermedia: true`',
			},
		},
	},
	{
		id: 'hypermedia-action-without-hypermedia',
		description: 'Hypermedia action calls require `hypermedia: true`',
		html: `<script is:state>
	let label = 'Items'
</script>
<button on:click="{ GET('/api/items') }">{ label }</button>`,
		flags: { reactivity: true, hypermedia: false },
		surfaces: {
			compiler: {
				code: 'AERO_CONFIG',
				messageIncludes: 'Hypermedia action calls require `hypermedia: true`',
			},
			vscode: {
				code: 'AERO_CONFIG',
				messageIncludes: 'Hypermedia action calls require `hypermedia: true`',
			},
		},
	},
	{
		id: 'malformed-props-braces',
		description: 'Directive props must use braced expression',
		html: '<div props="not-braced">x</div>',
		flags: { reactivity: false, hypermedia: false },
		surfaces: {
			compiler: {
				code: 'AERO_COMPILE',
				messageIncludes: 'Directive `props`',
			},
			cli: {
				code: 'AERO_COMPILE',
				messageIncludes: 'Directive `props`',
			},
			vscode: {
				code: 'AERO_COMPILE',
				messageIncludes: 'Directive `props`',
			},
		},
	},
	{
		id: 'hypermedia-string-state-option',
		description: 'Action state option must be signal ref, not string',
		html: `<script is:state>
	let isSaving = false
</script>
<button on:click="{ POST('/api/save', { state: 'isSaving' }) }">Save</button>`,
		flags: { reactivity: true, hypermedia: true },
		surfaces: {
			compiler: {
				code: 'AERO_CONFIG',
				messageIncludes: 'Hypermedia action `state` must reference a boolean state binding',
			},
			cli: {
				code: 'AERO_CONFIG',
				messageIncludes: 'Hypermedia action `state` must reference a boolean state binding',
			},
			vscode: {
				code: 'AERO_CONFIG',
				messageIncludes: 'Hypermedia action `state` must reference a boolean state binding, not a string',
			},
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
