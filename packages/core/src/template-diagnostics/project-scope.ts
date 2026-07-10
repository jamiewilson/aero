import * as fs from 'node:fs'
import path from 'node:path'

const AERO_CONFIG_FILES = ['aero.config.ts', 'aero.config.js', 'aero.config.mts', 'aero.config.mjs']
const VITE_CONFIG_FILES = ['vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs']
const ROOT_CANDIDATE_FILES = ['package.json', ...AERO_CONFIG_FILES, ...VITE_CONFIG_FILES]

const AERO_CONFIG_PATTERNS = [/@aero-js\/core\/config/, /@aero-js\/config/, /\bdefineConfig\s*\(/]
const VITE_CONFIG_PATTERNS = [
	/@aero-js\/core\/vite-config/,
	/@aero-js\/core\/vite/,
	/@aero-js\/vite/,
	/aero\.config\.(?:ts|js|mts|mjs)/,
]
const PACKAGE_PATTERNS = [/@aero-js\//]

function fileContainsAny(filePath: string, patterns: readonly RegExp[]): boolean {
	try {
		if (!fs.existsSync(filePath)) return false
		const content = fs.readFileSync(filePath, 'utf-8')
		return patterns.some(pattern => pattern.test(content))
	} catch {
		return false
	}
}

function fileContainsAll(filePath: string, patterns: readonly RegExp[]): boolean {
	try {
		if (!fs.existsSync(filePath)) return false
		const content = fs.readFileSync(filePath, 'utf-8')
		return patterns.every(pattern => pattern.test(content))
	} catch {
		return false
	}
}

function isRootCandidateDirectory(dir: string): boolean {
	return ROOT_CANDIDATE_FILES.some(fileName => fs.existsSync(path.join(dir, fileName)))
}

function isAeroProjectRoot(dir: string): boolean {
	return (
		AERO_CONFIG_FILES.some(fileName =>
			fileContainsAll(path.join(dir, fileName), AERO_CONFIG_PATTERNS)
		) ||
		VITE_CONFIG_FILES.some(fileName =>
			fileContainsAny(path.join(dir, fileName), VITE_CONFIG_PATTERNS)
		) ||
		fileContainsAny(path.join(dir, 'package.json'), PACKAGE_PATTERNS)
	)
}

/** Find the nearest detected Aero project root for a template path. */
export function findAeroProjectRoot(filePath: string, workspaceRoot?: string): string | undefined {
	let current = path.dirname(filePath)
	const fsRoot = path.parse(current).root
	const stopAt = workspaceRoot ? path.resolve(workspaceRoot) : fsRoot

	while (true) {
		if (isRootCandidateDirectory(current)) return isAeroProjectRoot(current) ? current : undefined
		if (current === stopAt || current === fsRoot) return undefined
		current = path.dirname(current)
	}
}

/** True when a file belongs to a detected Aero project. */
export function isAeroProjectPath(filePath: string, workspaceRoot?: string): boolean {
	return findAeroProjectRoot(filePath, workspaceRoot) !== undefined
}
