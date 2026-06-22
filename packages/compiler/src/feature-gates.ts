import type { IRNode, IRReactiveEventBind } from './ir'
import type { CompileOptions, ParseResult } from './types'
import { CompileError } from './types'
import { collectReactiveBinds } from './state-mount-codegen'
import { detectHypermediaIssues } from './hypermedia-script-analysis'

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
	bodyIR: IRNode[]
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

	const reactiveBinds = parsed.stateScript ? collectReactiveBinds(bodyIR) : { textBinds: [], eventBinds: [], busyBinds: [] }
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
		const issues = detectHypermediaIssues(eventBinds, parsed.template)
		for (const issue of issues) {
			if (issue.severity === 'error') {
				throw new CompileError({ message: issue.message, file })
			}
			options.onWarning?.({ code: 'AERO_COMPILE', message: issue.message, file })
		}
	}

	if (reactiveBinds.busyBinds.length > 0 && (options.reactivity === false || options.hypermedia === false)) {
		throw new CompileError({
			message: '`busy` requires both `reactivity: true` and `hypermedia: true` in aero.config.',
			file,
		})
	}
}
