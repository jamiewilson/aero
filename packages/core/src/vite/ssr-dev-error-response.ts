/**
 * Dev SSR error path: enrich CSS errors, emit diagnostics, serve error HTML.
 */

import type { ViteDevServer } from 'vite'
import path from 'node:path'
import {
	AERO_DIAGNOSTICS_HTTP_HEADER,
	type AeroDiagnostic,
	buildDevSsrErrorHtml,
	encodeDiagnosticsHeaderValue,
	enrichDiagnostics,
	normalizeToDiagnostics,
	renderDiagnostics,
	sharedDiagnosticLogGate,
	viteLoggerHasColors,
} from '@aero-js/diagnostics'
import { enrichCssSyntaxError } from './css-syntax-error-probe'
import { collectClientStyleCssFiles } from './collect-client-style-css'

/** Project-relative Vite client URL for an absolute source file. */
export function toViteClientModuleUrl(absFile: string, root: string): string | undefined {
	// Virtual / CSS-proxy ids are not valid client module URLs for HMR recovery.
	if (
		!absFile ||
		absFile.includes('\0') ||
		absFile.includes('html-proxy') ||
		absFile.includes('?')
	) {
		return undefined
	}
	const absolute = path.isAbsolute(absFile) ? absFile : path.join(root, absFile)
	const rel = path.relative(root, absolute)
	if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return undefined
	return '/' + rel.split(path.sep).join('/')
}

function isDebugEnabled(): boolean {
	const v = process.env.AERO_LOG
	return v === 'debug' || (typeof v === 'string' && v.split(/[\s,]+/).includes('debug'))
}

const ssrMetricsByCode = new Map<string, number>()
let ssrDiagnosticsTotal = 0

function recordSsrDiagnosticsMetrics(diagnostics: readonly AeroDiagnostic[]): void {
	if (diagnostics.length === 0) return
	ssrDiagnosticsTotal += diagnostics.length
	for (const d of diagnostics) {
		ssrMetricsByCode.set(d.code, (ssrMetricsByCode.get(d.code) ?? 0) + 1)
	}
	if (isDebugEnabled()) {
		console.error(
			`[aero] metrics[dev-ssr] +${diagnostics.length} diagnostics (total=${ssrDiagnosticsTotal}) ` +
				`codes=${diagnostics.map(d => d.code).join(',')}`
		)
	}
}

/**
 * Write a 500 response for a failed SSR render (enriched diagnostics in development).
 */
export async function renderDevSsrErrorResponse(args: {
	err: unknown
	res: import('node:http').ServerResponse
	server: ViteDevServer
	root: string | undefined
	clientDir: string
	pageTemplateHint: string | undefined
}): Promise<void> {
	const { err, res, server, root, clientDir, pageTemplateHint } = args
	const pluginCode =
		err && typeof err === 'object' && 'pluginCode' in err
			? (err as { pluginCode?: unknown }).pluginCode
			: undefined
	const entryId =
		err && typeof err === 'object' && 'id' in err ? (err as { id?: unknown }).id : undefined
	const enrichedErr =
		root
			? await enrichCssSyntaxError(err, {
					root,
					...(typeof pluginCode === 'string' ? { entryCode: pluginCode } : {}),
					...(typeof entryId === 'string' ? { entryId } : {}),
					candidateFiles: collectClientStyleCssFiles(root, clientDir),
					resolveCss: async (spec, importerBase) => {
						const importer = path.join(importerBase, '__aero_css_resolve.css')
						const resolved = await server.pluginContainer.resolveId(spec, importer)
						if (!resolved?.id) return false
						const cleaned = resolved.id.replace(/^\0+/, '').split('?')[0]!
						if (cleaned.includes('/node_modules/.vite/deps/')) return false
						return cleaned
					},
				})
			: err
	const diagnostics = enrichDiagnostics(
		normalizeToDiagnostics(enrichedErr, pageTemplateHint ? { file: pageTemplateHint } : {})
	)
	recordSsrDiagnosticsMetrics(diagnostics)
	const devDetails = server.config.mode === 'development'
	if (devDetails) {
		// Aero transform errors are already logged by Vite. Runtime SSR failures
		// print Aero terminal diagnostics once via the gate (HMR logger suppresses duplicates).
		const plugin =
			enrichedErr && typeof enrichedErr === 'object' && 'plugin' in enrichedErr
				? (enrichedErr as { plugin?: unknown }).plugin
				: err && typeof err === 'object' && 'plugin' in err
					? (err as { plugin?: unknown }).plugin
					: undefined
		// Transform-path errors are already printed by Vite's logger; runtime SSR is not.
		const aeroAlreadyLogged = typeof plugin === 'string' && plugin.includes('aero')
		const shouldLog = !aeroAlreadyLogged && sharedDiagnosticLogGate.shouldLog(diagnostics)
		if (shouldLog) {
			// Runtime SSR failures never hit Vite's transform error path, so dump
			// Aero terminal diagnostics (frame + File/Error) instead of a raw stack.
			const colors = viteLoggerHasColors(
				server.config.logger as { hasColors?: unknown }
			)
			server.config.logger.error(
				renderDiagnostics(diagnostics, 'dev-console', colors === undefined ? {} : { colors })
			)
		}
		res.statusCode = 500
		res.setHeader('Content-Type', 'text/html; charset=utf-8')
		res.setHeader(AERO_DIAGNOSTICS_HTTP_HEADER, encodeDiagnosticsHeaderValue(diagnostics))
		const recoverFile = diagnostics[0]?.span?.file ?? diagnostics[0]?.file ?? pageTemplateHint
		const recoverModuleId =
			root && recoverFile ? toViteClientModuleUrl(recoverFile, root) : undefined
		const bootstrap = buildDevSsrErrorHtml(diagnostics, {
			...(recoverModuleId ? { recoverModuleId } : {}),
			...(typeof plugin === 'string' ? { plugin } : {}),
		})
		// Serve raw: transformIndexHtml rewrites the inline bootstrap into an
		// html-proxy module cached by URL, which serves stale error scripts on
		// subsequent failures (the .html file on disk never changes).
		res.end(bootstrap)
		return
	}
	res.statusCode = 500
	res.setHeader('Content-Type', 'text/html; charset=utf-8')
	res.end(
		'<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body><h1>Internal Server Error</h1></body></html>'
	)
}
