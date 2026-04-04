/**
 * Parse diagnostics from a dev SSR error HTML document (browser-safe).
 */

import type { AeroDiagnostic } from './types'
import { AERO_DIAGNOSTICS_SCRIPT_ID, decodeDiagnosticsHeaderValue } from './wire-format'

/**
 * Parse diagnostics from full HTML (e.g. fetch body when header missing).
 */
export function extractDiagnosticsFromDevErrorHtml(html: string): AeroDiagnostic[] | null {
	const re = new RegExp(
		`<script\\s+type=["']text/plain["']\\s+id=["']${AERO_DIAGNOSTICS_SCRIPT_ID}["'][^>]*>([\\s\\S]*?)</script>`,
		'i'
	)
	const m = re.exec(html)
	if (!m?.[1]) return null
	return decodeDiagnosticsHeaderValue(m[1]!.trim())
}
