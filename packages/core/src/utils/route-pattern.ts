/**
 * Centralized handling of [param]-style route segments.
 * Shared by runtime (routing.ts) and build (vite/build.ts) for matching and expanding dynamic routes.
 *
 * @packageDocumentation
 */

/** Single segment of a route pattern: static literal or a named param. */
export type RouteSegment =
	| { type: 'static'; value: string }
	| { type: 'param'; name: string }

/** Parsed route pattern: ordered list of segments (e.g. `blog`, `[id]` for `blog/[id]`). */
export interface RoutePattern {
	segments: RouteSegment[]
}

/** Matches a single [param] segment; capture is param name (no leading . or ..., no ]). */
const PARAM_SEGMENT_REGEX = /^\[([^.\]\[]+)\]$/

/**
 * Parses a route pattern (page name) into segments.
 *
 * @param pattern - Page name with optional [param] segments (e.g. `blog/[id]`, `[slug]`).
 * @returns Parsed pattern; segments are static literals or params.
 */
export function parseRoutePattern(pattern: string): RoutePattern {
	const rawSegments = pattern.split('/').filter(Boolean)
	const segments: RouteSegment[] = rawSegments.map((seg) => {
		const paramMatch = seg.match(PARAM_SEGMENT_REGEX)
		if (paramMatch) {
			return { type: 'param', name: paramMatch[1] }
		}
		return { type: 'static', value: seg }
	})
	return { segments }
}

/**
 * Returns true if the pattern contains at least one param segment.
 *
 * @param pattern - Page name (e.g. `blog/[id]`).
 */
export function isDynamicRoutePattern(pattern: string): boolean {
	const { segments } = parseRoutePattern(pattern)
	return segments.some((s) => s.type === 'param')
}

/**
 * Matches a concrete page name against a route pattern.
 *
 * @param pattern - Route pattern (e.g. `blog/[id]`).
 * @param pageName - Requested page name (e.g. `blog/123`).
 * @returns Extracted params if the page name matches, otherwise null.
 */
export function matchRoutePattern(
	pattern: string,
	pageName: string,
): Record<string, string> | null {
	const { segments } = parseRoutePattern(pattern)
	const requestedSegments = pageName.split('/').filter(Boolean)
	if (segments.length !== requestedSegments.length) return null

	const params: Record<string, string> = {}
	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i]
		const requestSeg = requestedSegments[i]
		if (seg.type === 'param') {
			params[seg.name] = decodeURIComponent(requestSeg)
		} else if (seg.value !== requestSeg) {
			return null
		}
	}
	return params
}

/**
 * Replaces each [key] in the pattern with params[key].
 *
 * @param pattern - Route pattern (e.g. `docs/[slug]`).
 * @param params - Map of param names to values.
 * @returns Expanded page name (e.g. `docs/intro`).
 * @throws If a required param is missing from params.
 */
export function expandRoutePattern(
	pattern: string,
	params: Record<string, string>,
): string {
	const { segments } = parseRoutePattern(pattern)
	const parts: string[] = []
	for (const seg of segments) {
		if (seg.type === 'param') {
			if (!(seg.name in params)) {
				throw new Error(
					`[aero] getStaticPaths: missing param "${seg.name}" for pattern "${pattern}". ` +
						`Provided params: ${JSON.stringify(params)}`,
				)
			}
			parts.push(params[seg.name])
		} else {
			parts.push(seg.value)
		}
	}
	return parts.join('/')
}
