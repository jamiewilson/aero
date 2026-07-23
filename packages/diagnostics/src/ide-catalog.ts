/**
 * Doc URL helpers for IDE integrations (e.g. aero-vscode Problems panel code links).
 * Keeps dependency surface minimal: no Effect, no formatters.
 */

import type { AeroDiagnostic, AeroDiagnosticCode } from './types'

const REPO_DOCS_BASE = 'https://github.com/jamiewilson/aero/blob/main/docs'

/**
 * Full URL to a documentation file under the repo `docs/` directory (MDX source).
 *
 * @param docsFile - Relative path under `docs/`, e.g. `getting-started/templates.mdx`
 */
export function aeroIdeDocHref(docsFile: string): string {
	const trimmed = docsFile.replace(/^\/+/, '')
	return `${REPO_DOCS_BASE}/${trimmed}`
}

const DEFAULT_DOC = 'index.mdx'

/** Default docs page per stable {@link AeroDiagnosticCode} (Problems “Learn more”). */
const CODE_DOC: Record<AeroDiagnosticCode, string> = {
	AERO_COMPILE: 'getting-started/templates.mdx',
	AERO_PARSE: 'getting-started/templates.mdx',
	AERO_RESOLVE: 'guide/importing-and-bundling.mdx',
	AERO_ROUTE: 'getting-started/routing.mdx',
	AERO_TEMPLATE: 'guide/html-template.mdx',
	AERO_SWITCH: 'guide/html-template.mdx',
	AERO_CONTENT_SCHEMA: 'getting-started/content.mdx',
	AERO_CONFIG: 'getting-started/configuration.mdx',
	AERO_BUILD_SCRIPT: 'getting-started/scripts.mdx',
	AERO_SCRIPT: 'getting-started/scripts.mdx',
	AERO_INTERNAL: DEFAULT_DOC,
}

/**
 * Resolve the canonical documentation URL for a diagnostic code.
 */
export function aeroIdeDocsUrlForCode(code: AeroDiagnosticCode): string {
	return aeroIdeDocHref(CODE_DOC[code] ?? DEFAULT_DOC)
}

/**
 * Resolve the most specific canonical documentation URL for a diagnostic.
 */
export function aeroIdeDocsUrlForDiagnostic(
	diagnostic: Pick<AeroDiagnostic, 'code' | 'message' | 'docsUrl'>
): string {
	if (diagnostic.docsUrl) return diagnostic.docsUrl
	if (
		diagnostic.code === 'AERO_COMPILE' &&
		/readonly|state variable|reactive/i.test(diagnostic.message)
	) {
		return aeroIdeDocHref('getting-started/reactivity.mdx')
	}
	if (diagnostic.code === 'AERO_COMPILE' && /prop/i.test(diagnostic.message)) {
		return aeroIdeDocHref('getting-started/templates.mdx')
	}
	return aeroIdeDocsUrlForCode(diagnostic.code)
}
