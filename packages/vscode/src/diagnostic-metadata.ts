/**
 * Maps Aero template diagnostics to stable {@link AeroDiagnosticCode} values and doc URLs
 * for the VS Code Problems panel (code + clickable target).
 */
import * as vscode from 'vscode'
import type { AeroDiagnosticCode } from '@aero-js/diagnostics'
import { aeroIdeDocHref, aeroIdeDocsUrlForCode } from '@aero-js/diagnostics/ide-catalog'

const DIAGNOSTIC_SOURCE = 'aero'

/**
 * Set `source`, `code`, and documentation link on a VS Code diagnostic.
 *
 * @param docFile - Optional path under repo `docs/` (e.g. `props.md`). Defaults by code.
 */
export function applyAeroDiagnosticIdentity(
	diagnostic: vscode.Diagnostic,
	code: AeroDiagnosticCode,
	docFile?: string
): void {
	diagnostic.source = DIAGNOSTIC_SOURCE
	const href = docFile ? aeroIdeDocHref(docFile) : aeroIdeDocsUrlForCode(code)
	diagnostic.code = { value: code, target: vscode.Uri.parse(href) }
}
