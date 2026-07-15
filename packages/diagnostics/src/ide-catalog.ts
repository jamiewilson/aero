/**
 * Doc URL helpers for IDE integrations (e.g. aero-vscode Problems panel code links).
 * Keeps dependency surface minimal: no Effect, no formatters.
 */

import type { AeroDiagnostic, AeroDiagnosticCode } from './types'

const REPO_DOCS_BASE = 'https://github.com/jamiewilson/aero/blob/main/docs'

/**
 * Full URL to a documentation file under the repo `docs/` directory (MDX source).
 *
 * @param docsFile - Relative path under `docs/`, e.g. `concepts/templating.mdx`
 */
export function aeroIdeDocHref(docsFile: string): string {
	const trimmed = docsFile.replace(/^\/+/, '')
	return `${REPO_DOCS_BASE}/${trimmed}`
}

const DEFAULT_DOC = 'introduction.mdx'

/** Default docs page per stable {@link AeroDiagnosticCode} (Problems “Learn more”). */
const CODE_DOC: Record<AeroDiagnosticCode, string> = {
	AERO_COMPILE: 'concepts/templating.mdx',
	AERO_PARSE: 'concepts/templating.mdx',
	AERO_RESOLVE: 'guide/importing-and-bundling.mdx',
	AERO_ROUTE: 'concepts/routing.mdx',
	AERO_TEMPLATE: 'concepts/html-template.mdx',
	AERO_SWITCH: 'concepts/html-template.mdx',
	AERO_CONTENT_SCHEMA: 'data/content-collections.mdx',
	AERO_CONFIG: 'configuration/aero-config.mdx',
	AERO_BUILD_SCRIPT: 'concepts/scripts.mdx',
	AERO_SCRIPT: 'concepts/scripts.mdx',
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
		return aeroIdeDocHref('data/props.mdx')
	}
	return aeroIdeDocsUrlForCode(diagnostic.code)
}
