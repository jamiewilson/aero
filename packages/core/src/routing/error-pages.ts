import path from 'node:path'

/** Internal page name for `client/pages/error.html`. */
export const ERROR_PAGE_NAME = 'error'

export const ERROR_TEMPLATE_FILE = 'error.html'

export const ERROR_PRERENDER_PASSES = [
	{ status: 404, message: 'Page not found', outputFile: '404.html' },
	{ status: 500, message: 'Internal server error', outputFile: '500.html' },
] as const

/** Empty pathname for static error artifact prerender passes. */
export const ERROR_PRERENDER_PAGE_URL = new URL('http://localhost/')

/** Route path keys used when rewriting links to root-level error artifacts. */
export const ERROR_ARTIFACT_ROUTE_PATHS = new Set(['404', '500'])

export function isErrorPageName(pageName: string): boolean {
	return pageName === ERROR_PAGE_NAME
}

export function resolveErrorTemplatePath(root: string, clientDir: string): string {
	return path.join(root, clientDir, 'pages', ERROR_TEMPLATE_FILE)
}
