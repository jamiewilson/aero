/**
 * Build dev SSR error HTML (Node). Template source files live under
 * `render/templates/`; run `pnpm embed-templates` or `pnpm build` so `dist/` picks up changes.
 */

import { bannerTitleForCode } from './diagnostic-display'
import { formatDiagnosticsBrowserHtml } from './render/html'
import { ERROR_PAGE_HTML_TEMPLATE, OVERLAY_CSS } from './render/templates/generated-assets'
import type { AeroDiagnostic } from './types'
import { AERO_DIAGNOSTICS_SCRIPT_ID, diagnosticsForWire } from './wire-format'

function escapeHtmlText(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

/**
 * Minimal dev error document: visible panel + base64 UTF-8 payload in a script tag.
 */
export function buildDevSsrErrorHtml(diagnostics: readonly AeroDiagnostic[]): string {
	const wire = diagnosticsForWire(diagnostics)
	const b64 = Buffer.from(JSON.stringify(wire), 'utf-8').toString('base64')
	const pageTitle = wire.length > 0 ? bannerTitleForCode(wire[0]!.code) : 'Aero render error'
	const pageTitleHtml = escapeHtmlText(pageTitle)
	const panel = formatDiagnosticsBrowserHtml(wire, { banners: false })

	return ERROR_PAGE_HTML_TEMPLATE.replaceAll('{{ pageTitle }}', pageTitleHtml)
		.replaceAll('{{ overlayStyles }}', OVERLAY_CSS)
		.replaceAll('{{ panel }}', panel)
		.replaceAll('{{ scriptId }}', AERO_DIAGNOSTICS_SCRIPT_ID)
		.replaceAll('{{ payload }}', b64)
}
