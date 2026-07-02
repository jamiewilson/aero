/**
 * Cross-surface parity for build-directive semantics (native HTML collisions, braced values).
 * Surfaces: compiler compile, VS Code directive-braces check, Prettier prefix transforms.
 */

export type DirectiveParitySurface = 'compiler' | 'vscode' | 'prettier'

export type DirectiveParityOutcome = 'pass' | 'fail'

export interface DirectiveParityExpectation {
	readonly outcome: DirectiveParityOutcome
	/** When outcome is fail — substring match on compile throw or diagnostic message. */
	readonly messageIncludes?: string
	/** When outcome is fail — expected Aero diagnostic code (vscode). */
	readonly code?: string
}

export interface DirectiveParityPrettierExpectation {
	readonly aeroAttributePrefix: 'none' | 'aero' | 'data-aero'
	readonly mustContain?: readonly string[]
	readonly mustNotContain?: readonly string[]
}

export interface DirectiveParityScenario {
	readonly id: string
	readonly description: string
	/** Fragment appended after {@link DIRECTIVE_PARITY_BUILD_PREAMBLE} for compile tests. */
	readonly html: string
	readonly surfaces: Partial<Record<DirectiveParitySurface, DirectiveParityExpectation>>
	readonly prettier?: DirectiveParityPrettierExpectation
	/**
	 * Documented cross-surface gap until Phase 2 classification closes it.
	 * Tests still assert current behavior; comment points at target contract.
	 */
	readonly knownGap?: string
}

/** Minimal build script so compile tests can lower markup. */
export const DIRECTIVE_PARITY_BUILD_PREAMBLE =
	'<script is:build>const xs = [1], email = \'\', id = \'\'</script>'

export const DIRECTIVE_PARITY_SCENARIOS: readonly DirectiveParityScenario[] = [
	{
		id: 'native-for-on-label',
		description: 'Bare `for` on `<label>` is native HTML, not a loop directive',
		html: '<label for="email">Email</label>',
		surfaces: {
			compiler: { outcome: 'pass' },
			vscode: { outcome: 'pass' },
		},
		prettier: {
			aeroAttributePrefix: 'aero',
			mustContain: ['for="email"'],
			mustNotContain: ['aero-for'],
		},
	},
	{
		id: 'native-for-on-output',
		description: 'Bare `for` on `<output>` is native HTML',
		html: '<output for="a b">x</output>',
		surfaces: {
			compiler: { outcome: 'pass' },
			vscode: { outcome: 'pass' },
		},
	},
	{
		id: 'native-switch-on-input',
		description: 'Bare boolean `switch` on `<input>` is native HTML (Safari toggle)',
		html: '<input type="checkbox" switch>',
		surfaces: {
			compiler: { outcome: 'pass' },
			vscode: { outcome: 'pass' },
		},
		prettier: {
			aeroAttributePrefix: 'aero',
			mustContain: ['switch'],
			mustNotContain: ['aero-switch'],
		},
	},
	{
		id: 'native-default-on-track',
		description: 'Bare boolean `default` on `<track>` is native HTML outside a switch',
		html: '<video><track default></video>',
		surfaces: {
			compiler: { outcome: 'pass' },
			vscode: { outcome: 'pass' },
		},
		prettier: {
			aeroAttributePrefix: 'aero',
			mustContain: ['<track default'],
			mustNotContain: ['aero-default', 'data-aero-default'],
		},
	},
	{
		id: 'forgotten-brace-for-on-li',
		description: 'Bare `for` on non-native element without braces fails loud',
		html: '<li for="const x of xs">x</li>',
		surfaces: {
			compiler: {
				outcome: 'fail',
				messageIncludes: 'Directive `for` on <li> must use a braced expression',
			},
			vscode: {
				outcome: 'fail',
				code: 'AERO_COMPILE',
				messageIncludes: 'Directive `for` must use a braced expression',
			},
		},
	},
	{
		id: 'prefixed-for-on-label',
		description: 'Prefixed `aero-for` on `<label>` is always a directive, never native',
		html: '<label aero-for="email">x</label>',
		surfaces: {
			compiler: {
				outcome: 'fail',
				messageIncludes: 'Directive `aero-for` on <label> must use a braced expression',
			},
			vscode: {
				outcome: 'fail',
				code: 'AERO_COMPILE',
				messageIncludes: 'Directive `aero-for` must use a braced expression',
			},
		},
	},
	{
		id: 'braced-for-on-label',
		description: 'Braced bare `for` on `<label>` is treated as loop syntax, not native IDREF',
		html: '<label for="{ id }">x</label>',
		surfaces: {
			compiler: {
				outcome: 'fail',
				messageIncludes: 'for directive must be valid JavaScript',
			},
			vscode: { outcome: 'pass' },
		},
		knownGap: 'VS Code should classify braced-for-on-label as invalid directive in Phase 2',
	},
]
