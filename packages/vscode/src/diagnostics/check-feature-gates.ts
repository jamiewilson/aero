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
const STATE_SCRIPT_BLOCK_RE = /<script\b[^>]*\bis:state\b[^>]*>([\s\S]*?)<\/script>/i

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

function stripBraces(value: string): string {
	const trimmed = value.trim()
	return trimmed.startsWith('{') && trimmed.endsWith('}')
		? trimmed.slice(1, -1).trim()
		: trimmed
}

function simpleIdentifier(expression: string): string | null {
	const trimmed = expression.trim()
	return /^[A-Za-z_$][\w$]*$/.test(trimmed) ? trimmed : null
}

function isDefinitelyNonBooleanInit(initExpr: string): boolean {
	const trimmed = initExpr.trim()
	return (
		trimmed === 'undefined' ||
		trimmed === 'null' ||
		/^(['"]).*\1$/.test(trimmed) ||
		/^-?\d+(?:\.\d+)?$/.test(trimmed) ||
		/^[\[{]/.test(trimmed)
	)
}

function collectStateBindings(text: string): Map<string, string> {
	const match = text.match(STATE_SCRIPT_BLOCK_RE)
	const bindings = new Map<string, string>()
	if (!match) return bindings
	const script = match[1]
	for (const declaration of script.matchAll(/\blet\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)) {
		bindings.set(declaration[1], declaration[2])
	}
	return bindings
}

function pushFeatureDiagnostic(
	document: vscode.TextDocument,
	text: string,
	diagnostics: vscode.Diagnostic[],
	re: RegExp,
	message: string
): void {
	const diagnostic = new vscode.Diagnostic(
		rangeForMatch(document, text, re),
		message,
		vscode.DiagnosticSeverity.Error
	)
	applyAeroDiagnosticIdentity(diagnostic, 'AERO_CONFIG', 'aero-config.md')
	diagnostics.push(diagnostic)
}

function validateSignalReference(
	document: vscode.TextDocument,
	text: string,
	diagnostics: vscode.Diagnostic[],
	re: RegExp,
	bindings: ReadonlyMap<string, string>,
	name: string,
	missingMessage: (name: string) => string,
	nonBooleanMessage: (name: string) => string
): void {
	const initExpr = bindings.get(name)
	if (initExpr === undefined) {
		pushFeatureDiagnostic(document, text, diagnostics, re, missingMessage(name))
		return
	}
	if (isDefinitelyNonBooleanInit(initExpr)) {
		pushFeatureDiagnostic(document, text, diagnostics, re, nonBooleanMessage(name))
	}
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

	if (!flags.hypermedia && /\b(POST|GET|PUT|PATCH|DELETE)\s*\(/.test(text)) {
		const actionRegex = /\b(POST|GET|PUT|PATCH|DELETE)\s*\(/i
		const diagnostic = new vscode.Diagnostic(
			rangeForMatch(document, text, actionRegex),
			'Hypermedia action calls require `hypermedia: true` in aero.config. Enable the hypermedia flag or remove action calls.',
			vscode.DiagnosticSeverity.Error
		)
		applyAeroDiagnosticIdentity(diagnostic, 'AERO_CONFIG', 'aero-config.md')
		diagnostics.push(diagnostic)
	}

	const busyRegex = /\b(?:data-aero-|aero-)?busy\b\s*=\s*(['"])(.*?)\1/is
	const busyMatch = text.match(busyRegex)
	const stateBindings = flags.reactivity && flags.hypermedia ? collectStateBindings(text) : new Map<string, string>()
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
		} else if (!IS_STATE_SCRIPT_RE.test(text)) {
			pushFeatureDiagnostic(
				document,
				text,
				diagnostics,
				busyRegex,
				'`busy` attribute references must be declared in `<script is:state>`.'
			)
		} else {
			const signalName = simpleIdentifier(stripBraces(busyMatch[2] ?? ''))
			if (!signalName) {
				pushFeatureDiagnostic(
					document,
					text,
					diagnostics,
					busyRegex,
					'`busy` must reference one declared boolean state binding.'
				)
			} else {
				validateSignalReference(
					document,
					text,
					diagnostics,
					busyRegex,
					stateBindings,
					signalName,
					name => `Hypermedia busy signal not found: ${name}`,
					name => `Hypermedia busy signal must be boolean: ${name}`
				)
			}
		}
	}

	if (flags.reactivity && flags.hypermedia && /\b(POST|GET|PUT|PATCH|DELETE)\s*\(/.test(text)) {
		const stringStateRegex = /\bstate\s*:\s*(['"])[^'"]+\1/is
		if (stringStateRegex.test(text)) {
			pushFeatureDiagnostic(
				document,
				text,
				diagnostics,
				stringStateRegex,
				'Hypermedia action `state` must reference a boolean state binding, not a string.'
			)
			return
		}

		const identifierStateRegex = /\bstate\s*:\s*([A-Za-z_$][\w$]*)/is
		const stateMatch = text.match(identifierStateRegex)
		if (stateMatch) {
			validateSignalReference(
				document,
				text,
				diagnostics,
				identifierStateRegex,
				stateBindings,
				stateMatch[1],
				name => `Hypermedia action state signal not found: ${name}`,
				name => `Hypermedia action state signal must be boolean: ${name}`
			)
		}
	}
}
