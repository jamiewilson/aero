import type { IRNode, IRReactiveEventBind } from './ir'
import type { CompileOptions, ParseResult } from './types'
import { CompileError } from './types'
import { collectReactiveBinds } from './state-mount-codegen'
import { detectHypermediaIssues } from './hypermedia-script-analysis'
import {
	collectHypermediaActionImportsInBuildScript,
	collectMissingHypermediaActionImportsInStateScript,
	HYPERMEDIA_BUILD_IMPORT_MESSAGE,
	HYPERMEDIA_STATE_IMPORT_MESSAGE,
} from './hypermedia-build-imports'
import type { StateScriptAnalysisResult } from './state-script-analysis'
import { stripBraces } from '@aero-js/interpolation'

export interface FeatureGateFlags {
	readonly reactivity: boolean
	readonly hypermedia: boolean
}

export interface FeatureGateIssue {
	readonly message: string
	readonly code: 'AERO_CONFIG'
	readonly start?: number
	readonly end?: number
}

const IS_STATE_SCRIPT_RE = /<script\b[^>]*\bis:state\b/i
const STATE_SCRIPT_BLOCK_RE = /<script\b[^>]*\bis:state\b[^>]*>([\s\S]*?)<\/script>/i
const EFFECT_CALL_RE = /(?:\$effect|Aero\.effect)\s*\(/
const RUNTIME_BRACED_ATTR_RE =
	/\bdata-aero-(?:text|html|show|class|property|model|value|checked)(?:-[\w-]+)?\s*=\s*(['"])\s*\{[^'"]+\}\s*\1/i

function spanForMatch(source: string, re: RegExp): { start: number; end: number } | undefined {
	const match = re.exec(source)
	if (!match || match.index === undefined) return undefined
	return { start: match.index, end: match.index + match[0].length }
}

function simpleIdentifier(expression: string): string | null {
	const trimmed = expression.trim()
	return /^[A-Za-z_$][\w$]*$/.test(trimmed) ? trimmed : null
}

function isDefinitelyNonBooleanInit(initExpr: string): boolean {
	const trimmed = initExpr.trim()
	return (
		trimmed === 'undefined' ||
		trimmed === 'null' ||
		/^(['"]).*\1$/.test(trimmed) ||
		/^-?\d+(?:\.\d+)?$/.test(trimmed) ||
		/^[\[{]/.test(trimmed)
	)
}

function collectStateBindings(source: string): Map<string, string> {
	const match = source.match(STATE_SCRIPT_BLOCK_RE)
	const bindings = new Map<string, string>()
	if (!match) return bindings
	const script = match[1]
	for (const declaration of script.matchAll(/\blet\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)) {
		bindings.set(declaration[1], declaration[2])
	}
	return bindings
}

function sourceUsesEffectCall(parsed: ParseResult): boolean {
	if (EFFECT_CALL_RE.test(parsed.template)) return true
	if (parsed.buildScript && EFFECT_CALL_RE.test(parsed.buildScript.content)) return true
	for (const script of [
		...parsed.clientScripts,
		...parsed.inlineScripts,
		...parsed.blockingScripts,
	]) {
		if (EFFECT_CALL_RE.test(script.content)) return true
	}
	return false
}

function pushSourceIssue(
	out: FeatureGateIssue[],
	source: string,
	re: RegExp,
	message: string
): void {
	const span = spanForMatch(source, re)
	out.push({
		message,
		code: 'AERO_CONFIG',
		...(span ? { start: span.start, end: span.end } : {}),
	})
}

function validateSourceSignalReference(
	out: FeatureGateIssue[],
	source: string,
	re: RegExp,
	bindings: ReadonlyMap<string, string>,
	name: string,
	missingMessage: (name: string) => string,
	nonBooleanMessage: (name: string) => string
): void {
	const initExpr = bindings.get(name)
	if (initExpr === undefined) {
		pushSourceIssue(out, source, re, missingMessage(name))
		return
	}
	if (isDefinitelyNonBooleanInit(initExpr)) {
		pushSourceIssue(out, source, re, nonBooleanMessage(name))
	}
}

/** Source-level feature gate checks with byte spans for IDE/CLI diagnostics. */
export function collectFeatureGateIssuesFromSource(
	source: string,
	flags: FeatureGateFlags
): FeatureGateIssue[] {
	const out: FeatureGateIssue[] = []

	if (!flags.reactivity && IS_STATE_SCRIPT_RE.test(source)) {
		pushSourceIssue(
			out,
			source,
			IS_STATE_SCRIPT_RE,
			'`<script is:state>` requires `reactivity: true` in aero.config.'
		)
	}

	if (!IS_STATE_SCRIPT_RE.test(source) && RUNTIME_BRACED_ATTR_RE.test(source)) {
		pushSourceIssue(
			out,
			source,
			RUNTIME_BRACED_ATTR_RE,
			'Braced reactive `data-aero-*` attributes require `<script is:state>` (compiled bindings) or trusted `unsafeProcessFragment()` from JavaScript.'
		)
	}

	if (!IS_STATE_SCRIPT_RE.test(source) && EFFECT_CALL_RE.test(source)) {
		pushSourceIssue(
			out,
			source,
			EFFECT_CALL_RE,
			'`$effect` requires `<script is:state>` and `reactivity: true` in aero.config.'
		)
	}

	if (!flags.hypermedia && /\b(POST|GET|PUT|PATCH|DELETE)\s*\(/.test(source)) {
		pushSourceIssue(
			out,
			source,
			/\b(POST|GET|PUT|PATCH|DELETE)\s*\(/i,
			'Hypermedia action calls require `hypermedia: true` in aero.config. Enable the hypermedia flag or remove action calls.'
		)
	}

	const busyRegex = /\b(?:data-aero-|aero-)?busy\b\s*=\s*(['"])(.*?)\1/is
	const busyMatch = source.match(busyRegex)
	const stateBindings =
		flags.reactivity && flags.hypermedia ? collectStateBindings(source) : new Map<string, string>()

	if (busyMatch) {
		if (!flags.reactivity || !flags.hypermedia) {
			const missing: string[] = []
			if (!flags.hypermedia) missing.push('hypermedia: true')
			if (!flags.reactivity) missing.push('reactivity: true')
			pushSourceIssue(
				out,
				source,
				busyRegex,
				`\`busy\` requires ${missing.join(' and ')} in aero.config.`
			)
		} else if (!IS_STATE_SCRIPT_RE.test(source)) {
			pushSourceIssue(
				out,
				source,
				busyRegex,
				'`busy` attribute references must be declared in `<script is:state>`.'
			)
		} else {
			const signalName = simpleIdentifier(stripBraces(busyMatch[2] ?? ''))
			if (!signalName) {
				pushSourceIssue(
					out,
					source,
					busyRegex,
					'`busy` must reference one declared boolean state binding.'
				)
			} else {
				validateSourceSignalReference(
					out,
					source,
					busyRegex,
					stateBindings,
					signalName,
					name => `Hypermedia busy signal not found: ${name}`,
					name => `Hypermedia busy signal must be boolean: ${name}`
				)
			}
		}
	}

	if (flags.reactivity && flags.hypermedia && /\b(POST|GET|PUT|PATCH|DELETE)\s*\(/.test(source)) {
		const stringStateRegex = /\bstate\s*:\s*(['"])[^'"]+\1/is
		if (stringStateRegex.test(source)) {
			pushSourceIssue(
				out,
				source,
				stringStateRegex,
				'Hypermedia action `state` must reference a boolean state binding, not a string.'
			)
			return out
		}

		const identifierStateRegex = /\bstate\s*:\s*([A-Za-z_$][\w$]*)/is
		const stateMatch = source.match(identifierStateRegex)
		if (stateMatch) {
			validateSourceSignalReference(
				out,
				source,
				identifierStateRegex,
				stateBindings,
				stateMatch[1],
				name => `Hypermedia action state signal not found: ${name}`,
				name => `Hypermedia action state signal must be boolean: ${name}`
			)
		}
	}

	return out
}

export function collectFeatureGateIssues(
	parsed: ParseResult,
	options: CompileOptions,
	bodyIR: IRNode[],
	stateAnalysis?: StateScriptAnalysisResult | null
): FeatureGateIssue[] {
	const out: FeatureGateIssue[] = []
	const file = options.importer

	if (parsed.stateScript && options.reactivity === false) {
		out.push({
			code: 'AERO_CONFIG',
			message:
				'`<script is:state>` requires `reactivity: true` in aero.config. Enable the reactivity flag or remove the state script.',
		})
	}

	const bindingNames = parsed.stateScript
		? new Set(
				(parsed.stateScript.content.match(/\blet\s+(\w+)/g) ?? []).map(m => m.replace(/\blet\s+/, ''))
			)
		: new Set<string>()

	if (options.reactivity === false && walkIRForLiveDirectives(bodyIR, bindingNames)) {
		out.push({
			code: 'AERO_CONFIG',
			message:
				'Reactive directives (`text`, `on:*`, `busy`, or state-backed `{ }` interpolation) require `reactivity: true` in aero.config.',
		})
	}

	const reactiveBinds = parsed.stateScript
		? collectReactiveBinds(bodyIR)
		: {
				textBinds: [],
				eventBinds: [],
				busyBinds: [],
				componentBinds: [],
				showBinds: [],
				htmlBinds: [],
				classBinds: [],
				attributeBinds: [],
				propertyBinds: [],
				modelBinds: [],
				ifBinds: [],
				forBinds: [],
				switchBinds: [],
			}
	const eventBinds: IRReactiveEventBind[] = reactiveBinds.eventBinds

	if (options.hypermedia === false) {
		for (const bind of eventBinds) {
			if (/\b(POST|GET|PUT|PATCH|DELETE)\s*\(/.test(bind.handlerExpr)) {
				out.push({
					code: 'AERO_CONFIG',
					message:
						'Hypermedia action calls require `hypermedia: true` in aero.config. Enable the hypermedia flag or remove action calls.',
				})
				break
			}
		}
		if (
			out.length === 0 &&
			parsed.stateScript &&
			/\b(POST|GET|PUT|PATCH|DELETE)\s*\(/.test(parsed.stateScript.content)
		) {
			out.push({
				code: 'AERO_CONFIG',
				message:
					'Hypermedia action calls require `hypermedia: true` in aero.config. Enable the hypermedia flag or remove action calls.',
			})
		}
	}

	if (reactiveBinds.busyBinds.length > 0 && (options.reactivity === false || options.hypermedia === false)) {
		out.push({
			code: 'AERO_CONFIG',
			message: '`busy` requires both `reactivity: true` and `hypermedia: true` in aero.config.',
		})
	}

	const hasBusyAttr = /\b(?:data-aero-|aero-)?busy\b\s*=/i.test(parsed.template)
	if (hasBusyAttr && (options.reactivity === false || options.hypermedia === false)) {
		const busyMessage = '`busy` requires both `reactivity: true` and `hypermedia: true` in aero.config.'
		if (!out.some(issue => issue.message === busyMessage)) {
			out.push({ code: 'AERO_CONFIG', message: busyMessage })
		}
	}

	if (!parsed.stateScript && RUNTIME_BRACED_ATTR_RE.test(parsed.template)) {
		out.push({
			code: 'AERO_CONFIG',
			message:
				'Braced reactive `data-aero-*` attributes require `<script is:state>` (compiled bindings) or trusted `unsafeProcessFragment()` from JavaScript. Restricted `process()` supports `$store` refs and hypermedia action grammar only.',
		})
	}

	if (!parsed.stateScript && sourceUsesEffectCall(parsed)) {
		out.push({
			code: 'AERO_CONFIG',
			message:
				'`$effect` requires `<script is:state>` and `reactivity: true` in aero.config.',
		})
	}

	if (options.hypermedia === true && stateAnalysis) {
		for (const bind of reactiveBinds.busyBinds) {
			const name = simpleIdentifier(bind.readExpr)
			if (!name) {
				out.push({
					code: 'AERO_CONFIG',
					message: '`busy` must reference one declared boolean state binding.',
				})
				continue
			}
			const binding = stateAnalysis.bindings.find(item => item.name === name)
			if (!binding) {
				out.push({
					code: 'AERO_CONFIG',
					message: `Hypermedia busy signal not found: ${name}`,
				})
			} else if (binding.derived || isDefinitelyNonBooleanInit(binding.initExpr)) {
				out.push({
					code: 'AERO_CONFIG',
					message: `Hypermedia busy signal must be boolean: ${name}`,
				})
			}
		}

		for (const bind of eventBinds) {
			const handler = bind.handlerExpr
			if (!/\b(POST|GET|PUT|PATCH|DELETE)\s*\(/.test(handler)) continue

			if (/\bstate\s*:\s*(['"])[^'"]+\1/.test(handler)) {
				out.push({
					code: 'AERO_CONFIG',
					message:
						'Hypermedia action `state` must reference a boolean state binding, not a string.',
				})
				continue
			}

			const refs = handler.matchAll(/\bstate\s*:\s*([A-Za-z_$][\w$]*)/g)
			for (const match of refs) {
				const name = match[1]
				const binding = stateAnalysis.bindings.find(item => item.name === name)
				if (!binding) {
					out.push({
						code: 'AERO_CONFIG',
						message: `Hypermedia action state signal not found: ${name}`,
					})
				} else if (binding.derived || isDefinitelyNonBooleanInit(binding.initExpr)) {
					out.push({
						code: 'AERO_CONFIG',
						message: `Hypermedia action state signal must be boolean: ${name}`,
					})
				}
			}
		}
	}

	void file
	return out
}

function walkIRForLiveDirectives(nodes: IRNode[], bindingNames: ReadonlySet<string>): boolean {
	for (const node of nodes) {
		if (node.kind === 'ReactiveTextBind' || node.kind === 'ReactiveEventBind' || node.kind === 'ReactiveBusyBind') {
			return true
		}
		if (node.kind === 'For' || node.kind === 'If') {
			if (walkIRForLiveDirectives(node.body, bindingNames)) return true
			if (node.kind === 'If') {
				for (const branch of node.elseIf ?? []) {
					if (walkIRForLiveDirectives(branch.body, bindingNames)) return true
				}
				if (node.else && walkIRForLiveDirectives(node.else, bindingNames)) return true
			}
		}
		if (node.kind === 'Switch') {
			for (const branch of node.cases) {
				if (walkIRForLiveDirectives(branch.body, bindingNames)) return true
			}
			if (node.defaultBody && walkIRForLiveDirectives(node.defaultBody, bindingNames)) return true
		}
		if (node.kind === 'Component') {
			for (const slotIR of Object.values(node.slots)) {
				if (walkIRForLiveDirectives(slotIR, bindingNames)) return true
			}
		}
	}
	return false
}

export function validateFeatureGates(
	parsed: ParseResult,
	options: CompileOptions,
	bodyIR: IRNode[],
	stateAnalysis?: StateScriptAnalysisResult | null
): void {
	const file = options.importer

	for (const issue of collectFeatureGateIssues(parsed, options, bodyIR, stateAnalysis)) {
		throw new CompileError({ message: issue.message, file })
	}

	if (parsed.buildScript) {
		const banned = collectHypermediaActionImportsInBuildScript(parsed.buildScript.content)
		if (banned.length > 0) {
			throw new CompileError({ message: HYPERMEDIA_BUILD_IMPORT_MESSAGE, file })
		}
	}

	if (parsed.stateScript) {
		const missing = collectMissingHypermediaActionImportsInStateScript(parsed.stateScript.content)
		if (missing.length > 0) {
			throw new CompileError({ message: HYPERMEDIA_STATE_IMPORT_MESSAGE, file })
		}
	}

	const reactiveBinds = parsed.stateScript
		? collectReactiveBinds(bodyIR)
		: {
				textBinds: [],
				eventBinds: [],
				busyBinds: [],
				componentBinds: [],
				showBinds: [],
				htmlBinds: [],
				classBinds: [],
				attributeBinds: [],
				propertyBinds: [],
				modelBinds: [],
				ifBinds: [],
				forBinds: [],
				switchBinds: [],
			}
	const eventBinds: IRReactiveEventBind[] = reactiveBinds.eventBinds

	if (options.hypermedia === true) {
		const issues = detectHypermediaIssues(eventBinds, parsed.template, parsed.stateScript !== null)
		for (const issue of issues) {
			if (issue.severity === 'error') {
				throw new CompileError({ message: issue.message, file })
			}
			options.onWarning?.({ code: 'AERO_COMPILE', message: issue.message, file })
		}
	}
}
