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

const flagsCache = new Map<string, CachedFlags>()

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

export function checkFeatureGates(
	document: vscode.TextDocument,
	text: string,
	diagnostics: vscode.Diagnostic[]
): void {
	const root = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
	if (!root) return

	const flags = getFeatureFlags(root)

	if (!flags.reactivity && /<script\b[^>]*\bis:state\b/i.test(text)) {
		const diagnostic = new vscode.Diagnostic(
			new vscode.Range(0, 0, 0, 0),
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
				new vscode.Range(0, 0, 0, 0),
				`\`busy\` requires ${missing.join(' and ')} in aero.config.`,
				vscode.DiagnosticSeverity.Error
			)
			applyAeroDiagnosticIdentity(diagnostic, 'AERO_CONFIG', 'aero-config.md')
			diagnostics.push(diagnostic)
		}
	}
}
