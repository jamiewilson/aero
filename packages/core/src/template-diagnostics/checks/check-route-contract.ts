import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { pushOffsetDiagnostic, pushSpanDiagnostic } from '../aero-diagnostic-build'
import { rangeFromOffsets, type SourceDocument, type SourceRange } from '../source-document'
import * as path from 'node:path'
import type { PathResolver } from '../path-resolver'

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
	document: SourceDocument,
	diagnostics: AeroDiagnostic[],
	resolver: PathResolver
): void {
	const abs = path.resolve(document.uri.fsPath)
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
		pushOffsetDiagnostic(
			diagnostics,
			document,
			0,
			1,
			`Unsupported route segment ${JSON.stringify(seg)} in ${JSON.stringify(pageName)}. ${unsupportedSegmentHint(seg)}`,
			'AERO_ROUTE',
			'error'
		)
	}
}
