/**
 * Load merged {@link ts.CompilerOptions} from the project's tsconfig.json for CLI/typecheck alignment with the editor.
 */

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export type LoadedProjectTsConfig = {
	readonly options: ts.CompilerOptions
	readonly configDir: string
	readonly configFilePath: string
}

/**
 * Finds `tsconfig.json` at or under `root`, parses it (including `extends`), and returns merged compiler options.
 */
export function loadProjectTsConfig(root: string): LoadedProjectTsConfig | null {
	const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json')
	if (!configPath) return null
	const read = ts.readConfigFile(configPath, path => fs.readFileSync(path, 'utf-8'))
	if (read.error) return null
	const parsed = ts.parseJsonConfigFileContent(
		read.config,
		ts.sys,
		path.dirname(configPath),
		undefined,
		configPath
	)
	if (parsed.errors.length > 0) return null
	return {
		options: parsed.options,
		configDir: path.dirname(configPath),
		configFilePath: configPath,
	}
}

/**
 * Options suitable for single-file virtual checks: noEmit, skipLibCheck, preserve project's strictness and paths.
 */
export function compilerOptionsForVirtualCheck(
	base: ts.CompilerOptions | undefined
): ts.CompilerOptions {
	const o = { ...base } as ts.CompilerOptions
	o.noEmit = true
	o.skipLibCheck = true
	o.noEmitOnError = false
	// Imports are often for side effects / default HTML modules; virtual files are not real project roots.
	o.noUnusedLocals = false
	o.noUnusedParameters = false
	return o
}
