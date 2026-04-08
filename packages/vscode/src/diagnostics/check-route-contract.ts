import * as vscode from 'vscode'
import * as path from 'node:path'
import type { PathResolver } from '../pathResolver'
import { applyAeroDiagnosticIdentity } from '../diagnostic-metadata'

const SUPPORTED_PARAM_SEGMENT = /^[A-Za-z_][A-Za-z0-9_]*$/

function unsupportedSegmentHint(segment: string): string {
	const inner = segment.slice(1, -1)
	if (inner.startsWith('...')) {
		return 'Catch-all syntax is not supported yet. Use static segments or single-parameter [name] segments.'
	}
	if (inner.endsWith('?')) {
		return 'Optional parameter syntax is not supported yet. Use explicit static routes or separate files.'
	}
	return 'Use bracket parameter segments like [id] with alphanumeric/underscore names.'
}

export function checkRouteContract(
	document: vscode.TextDocument,
	diagnostics: vscode.Diagnostic[],
	resolver: PathResolver
): void {
	const abs = path.resolve(document.fileName)
	const pagesDir = path.resolve(resolver.pagesDir)
	if (abs !== pagesDir && !abs.startsWith(pagesDir + path.sep)) return
	if (!abs.endsWith('.html')) return

	const rel = path.relative(pagesDir, abs).split(path.sep).join('/')
	const pageName = rel.replace(/\.html$/i, '')
	const segments = pageName.split('/').filter(Boolean)
	for (const seg of segments) {
		if (!seg.startsWith('[') || !seg.endsWith(']')) continue
		const inner = seg.slice(1, -1)
		if (SUPPORTED_PARAM_SEGMENT.test(inner)) continue
		const diagnostic = new vscode.Diagnostic(
			new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1)),
			`Unsupported route segment ${JSON.stringify(seg)} in ${JSON.stringify(pageName)}. ${unsupportedSegmentHint(seg)}`,
			vscode.DiagnosticSeverity.Error
		)
		applyAeroDiagnosticIdentity(diagnostic, 'AERO_ROUTE', 'routing.md')
		diagnostics.push(diagnostic)
	}
}
