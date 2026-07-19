/**
 * Compile-warning dedup and HTML compile helpers shared by virtuals + transform plugins.
 */

import type { ScriptEntry } from '../types'
import type { ResolvedConfig, TransformResult } from 'vite'
import { createHash } from 'node:crypto'
import path from 'path'
import { reportAeroFailure } from '@aero-js/diagnostics'
import { collectComponentReactivePropMetadata } from '@aero-js/compiler'
import { compileHtmlSourceForVite } from './compile-html-for-vite'
import type { AeroPluginState } from './plugin-state'

export interface CompileWarningPayload {
	line?: number
	column?: number
	file?: string
	code: string
	message: string
}

/** Emit warnings only when `source` changed since the last flush for `filePath`. */
export function flushCompileWarnings(
	lastLoggedHashByFile: Map<string, string>,
	filePath: string,
	source: string,
	warnings: readonly CompileWarningPayload[],
	log: (warning: CompileWarningPayload) => void
): void {
	if (warnings.length === 0) return
	const hash = createHash('sha256').update(source).digest('hex').slice(0, 16)
	if (lastLoggedHashByFile.get(filePath) === hash) return
	lastLoggedHashByFile.set(filePath, hash)
	for (const warning of warnings) {
		log(warning)
	}
}

function logCompileWarning(
	resolvedConfig: ResolvedConfig,
	fallbackFile: string,
	warning: CompileWarningPayload
): void {
	const loc =
		warning.line !== undefined && warning.column !== undefined
			? `:${warning.line}:${warning.column}`
			: ''
	const where = warning.file ? `${warning.file}${loc}` : fallbackFile
	resolvedConfig.logger.warn(`[aero] [${warning.code}] ${where}\n  warning: ${warning.message}`)
}

export function compileHtmlWithDedupedWarnings(
	code: string,
	filePath: string,
	params: {
		resolvedConfig: ResolvedConfig
		resolvePath: (specifier: string, importer: string) => string
		reactivity?: boolean
		hypermedia?: boolean
		dirs: AeroPluginState['dirs']
	},
	clientScripts: Map<string, ScriptEntry>,
	compileWarningHashes: Map<string, string>
): Pick<TransformResult, 'code' | 'map'> {
	const warnings: CompileWarningPayload[] = []
	const componentReactiveProps = collectComponentReactivePropMetadata([
		path.join(params.resolvedConfig.root, params.dirs.client, 'components'),
		path.join(params.resolvedConfig.root, params.dirs.client, 'layouts'),
	])
	const generated = compileHtmlSourceForVite(
		code,
		filePath,
		{
			...params,
			componentReactiveProps,
			onWarning: warning => {
				warnings.push(warning)
			},
		},
		clientScripts
	)
	flushCompileWarnings(compileWarningHashes, filePath, code, warnings, warning =>
		logCompileWarning(params.resolvedConfig, filePath, warning)
	)
	return generated as Pick<TransformResult, 'code' | 'map'>
}

/** Turn a compile failure into JS source + map, or call Vite `error` on failure. */
type ViteCompileResult = Pick<TransformResult, 'code' | 'map'>

export function compileOrReport(
	ctx: { error(payload: unknown): never },
	compileFn: () => ViteCompileResult,
	filePath: string,
	pluginName: string
): ViteCompileResult {
	try {
		return compileFn()
	} catch (err) {
		ctx.error(
			reportAeroFailure(err, { defaultFile: filePath, plugin: pluginName }, 'vite-overlay')
		)
	}
}
