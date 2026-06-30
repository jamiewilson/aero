import type { IRNode, IRReactiveEventBind } from './ir'
import type { CompileOptions, ParseResult } from './types'
import { CompileError } from './types'
import { collectReactiveBinds } from './state-mount-codegen'
import { detectHypermediaIssues } from './hypermedia-script-analysis'
import type { StateScriptAnalysisResult } from './state-script-analysis'

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

	if (parsed.stateScript && options.reactivity === false) {
		throw new CompileError({
			message:
				'`<script is:state>` requires `reactivity: true` in aero.config. Enable the reactivity flag or remove the state script.',
			file,
		})
	}

	const bindingNames = parsed.stateScript
		? new Set(
				(parsed.stateScript.content.match(/\blet\s+(\w+)/g) ?? []).map(m => m.replace(/\blet\s+/, ''))
			)
		: new Set<string>()

	if (options.reactivity === false && walkIRForLiveDirectives(bodyIR, bindingNames)) {
		throw new CompileError({
			message:
				'Reactive directives (`text`, `on:*`, `busy`, or state-backed `{ }` interpolation) require `reactivity: true` in aero.config.',
			file,
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
				throw new CompileError({
					message:
						'Hypermedia action calls require `hypermedia: true` in aero.config. Enable the hypermedia flag or remove action calls.',
					file,
				})
			}
		}
		if (parsed.stateScript && /\b(POST|GET|PUT|PATCH|DELETE)\s*\(/.test(parsed.stateScript.content)) {
			throw new CompileError({
				message:
					'Hypermedia action calls require `hypermedia: true` in aero.config. Enable the hypermedia flag or remove action calls.',
				file,
			})
		}
	}

	if (options.hypermedia === true) {
		const issues = detectHypermediaIssues(eventBinds, parsed.template, parsed.stateScript !== null)
		for (const issue of issues) {
			if (issue.severity === 'error') {
				throw new CompileError({ message: issue.message, file })
			}
			options.onWarning?.({ code: 'AERO_COMPILE', message: issue.message, file })
		}

		if (stateAnalysis) {
			validateHypermediaSignalRefs(reactiveBinds.busyBinds, eventBinds, stateAnalysis, file)
		}
	}

	if (reactiveBinds.busyBinds.length > 0 && (options.reactivity === false || options.hypermedia === false)) {
		throw new CompileError({
			message: '`busy` requires both `reactivity: true` and `hypermedia: true` in aero.config.',
			file,
		})
	}

	const hasBusyAttr = /\b(?:data-aero-|aero-)?busy\b\s*=/i.test(parsed.template)
	if (hasBusyAttr && (options.reactivity === false || options.hypermedia === false)) {
		throw new CompileError({
			message: '`busy` requires both `reactivity: true` and `hypermedia: true` in aero.config.',
			file,
		})
	}
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

function assertBooleanStateBinding(
	name: string,
	analysis: StateScriptAnalysisResult,
	file: string | undefined,
	missingMessage: (name: string) => string,
	nonBooleanMessage: (name: string) => string
): void {
	const binding = analysis.bindings.find(item => item.name === name)
	if (!binding) {
		throw new CompileError({ message: missingMessage(name), file })
	}
	if (binding.derived || isDefinitelyNonBooleanInit(binding.initExpr)) {
		throw new CompileError({ message: nonBooleanMessage(name), file })
	}
}

function validateHypermediaSignalRefs(
	busyBinds: readonly { readExpr: string }[],
	eventBinds: readonly IRReactiveEventBind[],
	analysis: StateScriptAnalysisResult,
	file: string | undefined
): void {
	for (const bind of busyBinds) {
		const name = simpleIdentifier(bind.readExpr)
		if (!name) {
			throw new CompileError({
				message: '`busy` must reference one declared boolean state binding.',
				file,
			})
		}
		assertBooleanStateBinding(
			name,
			analysis,
			file,
			ref => `Hypermedia busy signal not found: ${ref}`,
			ref => `Hypermedia busy signal must be boolean: ${ref}`
		)
	}

	for (const bind of eventBinds) {
		const handler = bind.handlerExpr
		if (!/\b(POST|GET|PUT|PATCH|DELETE)\s*\(/.test(handler)) continue

		if (/\bstate\s*:\s*(['"])[^'"]+\1/.test(handler)) {
			throw new CompileError({
				message:
					'Hypermedia action `state` must reference a boolean state binding, not a string.',
				file,
			})
		}

		const refs = handler.matchAll(/\bstate\s*:\s*([A-Za-z_$][\w$]*)/g)
		for (const match of refs) {
			const name = match[1]
			assertBooleanStateBinding(
				name,
				analysis,
				file,
				ref => `Hypermedia action state signal not found: ${ref}`,
				ref => `Hypermedia action state signal must be boolean: ${ref}`
			)
		}
	}
}
