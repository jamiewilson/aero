/**
 * Diagnostic check: feature flags gating (`is:state` requires `reactivity`, `busy` requires both).
 */
import { loadAeroConfig } from '@aero-js/config'
import type { AeroConfig, AeroConfigFunction } from '@aero-js/config'
import * as vscode from 'vscode'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { applyAeroDiagnosticIdentity } from '../diagnostic-metadata'

interface FeatureFlags {
	reactivity: boolean
	hypermedia: boolean
}

interface CachedFlags extends FeatureFlags {
	mtimeMs: number
}

const AERO_CONFIG_NAMES = ['aero.config.ts', 'aero.config.js', 'aero.config.mjs'] as const
const IS_STATE_SCRIPT_RE = /<script\b[^>]*\bis:state\b/i

const flagsCache = new Map<string, CachedFlags>()

/** Nearest Aero app root (matches pathResolver semantics for monorepo nested apps). */
function findAeroAppRoot(startDir: string, workspaceRoot?: string): string | undefined {
	let current = startDir
	const fsRoot = path.parse(current).root
	const stopAt = workspaceRoot ? path.resolve(workspaceRoot) : fsRoot

	while (current !== stopAt && current !== fsRoot) {
		if (fs.existsSync(path.join(current, 'client'))) return current
		if (fs.existsSync(path.join(current, 'frontend'))) return current
		for (const name of AERO_CONFIG_NAMES) {
			if (fs.existsSync(path.join(current, name))) return current
		}
		current = path.dirname(current)
	}
	return undefined
}

function findConfigFile(root: string): string | null {
	for (const name of AERO_CONFIG_NAMES) {
		const filePath = path.join(root, name)
		if (fs.existsSync(filePath)) return filePath
	}
	return null
}

function resolveFeatureFlags(aero: AeroConfig): FeatureFlags {
	return {
		reactivity: aero.reactivity === true,
		hypermedia: aero.hypermedia === true,
	}
}

function getFeatureFlags(root: string): FeatureFlags {
	const configFile = findConfigFile(root)
	if (!configFile) return { reactivity: false, hypermedia: false }

	const stat = fs.statSync(configFile)
	const mtimeMs = stat.mtimeMs
	const cached = flagsCache.get(root)
	if (cached && cached.mtimeMs === mtimeMs) {
		return cached
	}

	const loaded = loadAeroConfig(root)
	const config: AeroConfig =
		loaded && typeof loaded === 'function'
			? (loaded as AeroConfigFunction)({ command: 'dev', mode: 'development' })
			: (loaded as AeroConfig | null) ?? {}
	const flags = { ...resolveFeatureFlags(config), mtimeMs }
	flagsCache.set(root, flags)
	return flags
}

function rangeForMatch(
	document: vscode.TextDocument,
	text: string,
	re: RegExp
): vscode.Range {
	const match = re.exec(text)
	if (!match || match.index === undefined) {
		return new vscode.Range(0, 0, 0, 0)
	}
	const start = document.positionAt(match.index)
	const end = document.positionAt(match.index + match[0].length)
	return new vscode.Range(start, end)
}

export function checkFeatureGates(
	document: vscode.TextDocument,
	text: string,
	diagnostics: vscode.Diagnostic[]
): void {
	const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
	if (!workspaceRoot) return

	const docDir = path.dirname(document.uri.fsPath)
	const projectRoot = findAeroAppRoot(docDir, workspaceRoot) ?? workspaceRoot
	const flags = getFeatureFlags(projectRoot)

	if (!flags.reactivity && IS_STATE_SCRIPT_RE.test(text)) {
		const diagnostic = new vscode.Diagnostic(
			rangeForMatch(document, text, IS_STATE_SCRIPT_RE),
			'`<script is:state>` requires `reactivity: true` in aero.config.',
			vscode.DiagnosticSeverity.Error
		)
		applyAeroDiagnosticIdentity(diagnostic, 'AERO_CONFIG', 'aero-config.md')
		diagnostics.push(diagnostic)
	}

	const busyRegex = /\b(?:data-aero-|aero-)?busy\b\s*=\s*(['"]).*?\1/is
	const busyMatch = text.match(busyRegex)
	if (busyMatch) {
		if (!flags.reactivity || !flags.hypermedia) {
			const missing: string[] = []
			if (!flags.hypermedia) missing.push('hypermedia: true')
			if (!flags.reactivity) missing.push('reactivity: true')
			const diagnostic = new vscode.Diagnostic(
				rangeForMatch(document, text, busyRegex),
				`\`busy\` requires ${missing.join(' and ')} in aero.config.`,
				vscode.DiagnosticSeverity.Error
			)
			applyAeroDiagnosticIdentity(diagnostic, 'AERO_CONFIG', 'aero-config.md')
			diagnostics.push(diagnostic)
		}
	}
}
