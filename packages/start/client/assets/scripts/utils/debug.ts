export const AERO_LOG_PREFIX = '%c[aero]'
export const AERO_LOG_STYLE = 'color: gold;'

export function debug(...args: any[]) {
	console.log(AERO_LOG_PREFIX, AERO_LOG_STYLE, ...args)
}
