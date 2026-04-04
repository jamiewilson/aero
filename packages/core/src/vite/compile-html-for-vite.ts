/**
 * Shared HTML → JS compile path for Vite load and transform hooks (parse, client script URLs, codegen).
 */

import type { ResolvedConfig } from 'vite'
import type { ScriptEntry } from '../types'
import { compileTemplate, parse } from '@aero-js/compiler'
import { getClientScriptVirtualUrl } from './defaults'
import { toPosixRelative } from '../utils/path'
import { syncClientScriptsForTemplate } from './client-script-sync'

/** Parameters from resolved Vite config and alias resolution; used by both virtual load and .html transform. */
interface CompileHtmlForViteParams {
	resolvedConfig: ResolvedConfig
	resolvePath: (specifier: string, importer: string) => string
}

/**
 * Parse template source, sync client script map, rewrite virtual URLs, and run codegen.
 * Caller wraps in `htmlCompileTry` / `compileExitToGeneratedOrReport`.
 */
export function compileHtmlSourceForVite(
	code: string,
	filePath: string,
	params: CompileHtmlForViteParams,
	clientScripts: Map<string, ScriptEntry>
): string {
	const parsed = parse(code)
	const relativePath = toPosixRelative(filePath, params.resolvedConfig.root)
	const baseName = relativePath.replace(/\.html$/i, '')
	syncClientScriptsForTemplate(parsed, baseName, clientScripts)
	if (parsed.clientScripts.length > 0) {
		for (let i = 0; i < parsed.clientScripts.length; i++) {
			parsed.clientScripts[i].content = getClientScriptVirtualUrl(
				baseName,
				i,
				parsed.clientScripts.length
			)
		}
	}
	return compileTemplate(
		code,
		{
			root: params.resolvedConfig.root,
			clientScripts: parsed.clientScripts,
			blockingScripts: parsed.blockingScripts,
			inlineScripts: parsed.inlineScripts,
			resolvePath: params.resolvePath,
			importer: filePath,
		},
		parsed
	)
}
