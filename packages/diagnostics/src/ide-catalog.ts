/**
 * Doc URL helpers for IDE integrations (e.g. aero-vscode Problems panel code links).
 * Keeps dependency surface minimal: no Effect, no formatters.
 */

import type { AeroDiagnosticCode } from './types'

const REPO_DOCS_BASE = 'https://github.com/jamiewilson/aero/blob/main/docs'

/**
 * Full URL to a Markdown file under the repo `docs/` directory.
 *
 * @param docsFile - Relative path, e.g. `interpolation.md`
 */
export function aeroIdeDocHref(docsFile: string): string {
	const trimmed = docsFile.replace(/^\/+/, '')
	return `${REPO_DOCS_BASE}/${trimmed}`
}

const DEFAULT_DOC = 'README.md'

/** Default docs page per stable {@link AeroDiagnosticCode} (Problems “Learn more”). */
const CODE_DOC: Record<AeroDiagnosticCode, string> = {
	AERO_COMPILE: 'interpolation.md',
	AERO_PARSE: 'interpolation.md',
	AERO_RESOLVE: 'importing-and-bundling.md',
	AERO_ROUTE: 'routing.md',
	AERO_TEMPLATE: 'html-template-element.md',
	AERO_SWITCH: 'html-template-element.md',
	AERO_CONTENT_SCHEMA: 'content-api.md',
	AERO_CONFIG: 'getting-started.md',
	AERO_BUILD_SCRIPT: 'script-taxonomy.md',
	AERO_INTERNAL: DEFAULT_DOC,
}

/**
 * Resolve the canonical documentation URL for a diagnostic code.
 */
export function aeroIdeDocsUrlForCode(code: AeroDiagnosticCode): string {
	return aeroIdeDocHref(CODE_DOC[code] ?? DEFAULT_DOC)
}
