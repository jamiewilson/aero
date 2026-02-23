/**
 * Convert Aero redirect rules to Nitro routeRules for use in nitro.config.ts.
 * Used when AERO_REDIRECTS env is set by the Aero Vite plugin before nitro build.
 */
import type { RedirectRule } from '@aero-ssg/core/types'

/** Nitro routeRules redirect value: shorthand (307) or object with statusCode. */
type NitroRedirectRule =
	| string
	| { to: string; statusCode: number }

/**
 * Map redirect rules to Nitro's routeRules shape.
 *
 * @param redirects - Array of { from, to, status? } from aero config.
 * @returns Record suitable for spreading into Nitro's routeRules.
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
