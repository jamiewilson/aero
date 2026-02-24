/**
 * Convert Aero redirect rules to Nitro routeRules.
 * Used when generating Nitro config from Aero options (no project nitro.config.ts).
 */
import type { RedirectRule } from '../types'

/** Nitro routeRules redirect value: shorthand (307) or object with statusCode. */
type NitroRedirectRule = string | { to: string; statusCode: number }

/**
 * Map redirect rules to Nitro's routeRules shape.
 *
 * @param redirects - Array of { from, to, status? } from aero config.
 * @returns Record suitable for Nitro's routeRules.
 */
export function redirectsToRouteRules(
	redirects: RedirectRule[],
): Record<string, { redirect: NitroRedirectRule }> {
	const out: Record<string, { redirect: NitroRedirectRule }> = {}
	for (const rule of redirects) {
		const status = rule.status ?? 302
		out[rule.from] = {
			redirect:
				status === 307 ? rule.to : { to: rule.to, statusCode: status },
		}
	}
	return out
}
