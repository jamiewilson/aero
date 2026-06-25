import type { IRReactiveEventBind } from './ir'

export interface HypermediaIssue {
	readonly severity: 'error' | 'warning'
	readonly message: string
}

const ACTION_CALL_RE = /\b(POST|GET|PUT|PATCH|DELETE)\s*\(/g

function stripHandlerBraces(expr: string): string {
	const trimmed = expr.trim()
	if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
		return trimmed.slice(1, -1).trim()
	}
	return trimmed
}

function isPureActionCall(handlerExpr: string): boolean {
	const inner = stripHandlerBraces(handlerExpr)
	const match = inner.match(/^(POST|GET|PUT|PATCH|DELETE)\s*\([^)]*\)(?:\s*,\s*\{[^}]*\})?\s*;?$/)
	return match != null
}

function extractActionUrl(handlerExpr: string): string | null {
	const inner = stripHandlerBraces(handlerExpr)
	const match = inner.match(/^(POST|GET|PUT|PATCH|DELETE)\s*\(\s*(['"])([^'"]*)\2/)
	return match?.[3] ?? null
}

export function detectHypermediaIssues(
	eventBinds: readonly IRReactiveEventBind[],
	templateSource: string
): HypermediaIssue[] {
	const issues: HypermediaIssue[] = []

	for (const bind of eventBinds) {
		const inner = stripHandlerBraces(bind.handlerExpr)
		if (!ACTION_CALL_RE.test(inner)) continue
		ACTION_CALL_RE.lastIndex = 0

		if (!isPureActionCall(bind.handlerExpr)) {
			issues.push({
				severity: 'error',
				message:
					'Mixed hypermedia action expressions are not allowed. Use one action call per handler; use lifecycle events for side effects.',
			})
		}

		const url = extractActionUrl(bind.handlerExpr)
		if (url == null && /\b(POST|GET|PUT|PATCH|DELETE)\s*\(\s*[^'"]/.test(inner)) {
			issues.push({
				severity: 'warning',
				message:
					'Dynamic hypermedia URL cannot be extracted for native fallback at compile time. Consider a string literal URL for progressive enhancement.',
			})
		}

		if (bind.event === 'submit' && bind.modifiers.includes('prevent') === false) {
			const hasPost = /\bPOST\s*\(/.test(inner)
			if (hasPost) {
				issues.push({
					severity: 'warning',
					message:
						'Form `POST()` handlers should use `on:submit.prevent` to avoid double submission (native + hypermedia).',
				})
			}
		}
	}

	if (/\bbusy\s*=/.test(templateSource) && !/\bis:state\b/.test(templateSource)) {
		issues.push({
			severity: 'error',
			message: '`busy` attribute references must be declared in `<script is:state>`.',
		})
	}

	return issues
}

export function extractStaticActionUrl(handlerExpr: string): { method: string; url: string } | null {
	const inner = stripHandlerBraces(handlerExpr)
	const match = inner.match(/^(POST|GET|PUT|PATCH|DELETE)\s*\(\s*(['"])([^'"]*)\2/)
	if (!match) return null
	return { method: match[1], url: match[3] }
}
