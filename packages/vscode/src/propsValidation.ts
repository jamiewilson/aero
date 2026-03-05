/**
 * Prop validation: extract required props from TypeScript interfaces and compare
 * with passed props for cross-file validation diagnostics.
 *
 * Interface parsing is regex-based and may miss complex TypeScript (generics,
 * conditional types, intersection types). Simple interfaces with `prop: Type`
 * and `prop?: Type` are supported.
 */
import * as fs from 'node:fs'
import { getPropsTypeFromBuildScript } from '@aerobuilt/core/editor'
import { analyzeBuildScriptForEditor } from '@aerobuilt/core/editor'
import type { PathResolver } from './pathResolver'

/** Match import type { ... } from 'spec' - captures braced content and specifier */
const TYPE_IMPORT_REGEX =
	/import\s+type\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g

/** Interface body parsing result: required and optional property names. */
export interface ParsedInterface {
	required: string[]
	optional: string[]
}

const SCRIPT_TAG_REGEX = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
const INTERFACE_REGEX =
	/\b(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)\s*\{([^}]*)\}/g
const PROPERTY_REGEX = /([A-Za-z_$][\w$]*)\s*\??\s*:/g

/**
 * Extract required and optional props from a TypeScript interface body.
 * Properties with `?` are optional; others are required.
 */
export function parseInterfaceBody(body: string): ParsedInterface {
	const required: string[] = []
	const optional: string[] = []
	let match: RegExpExecArray | null
	PROPERTY_REGEX.lastIndex = 0
	while ((match = PROPERTY_REGEX.exec(body)) !== null) {
		const fullMatch = match[0]
		const name = match[1]
		const isOptional = fullMatch.includes('?')
		if (isOptional) {
			optional.push(name)
		} else {
			required.push(name)
		}
	}
	return { required, optional }
}

/**
 * Find an interface by name in source text. Returns parsed required/optional props.
 */
export function findInterfaceInSource(
	source: string,
	interfaceName: string
): ParsedInterface | null {
	INTERFACE_REGEX.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = INTERFACE_REGEX.exec(source)) !== null) {
		if (match[1] === interfaceName) {
			return parseInterfaceBody(match[2])
		}
	}
	return null
}

/**
 * Get required props for a type used in a component's build script.
 * Resolves inline interfaces or imported types from @content/types/props etc.
 *
 * @param typeName - The type name (e.g. HeaderProps, MetaProps).
 * @param componentContent - Full HTML content of the component file.
 * @param componentPath - Absolute path to the component file (for resolving imports).
 * @param resolver - Path resolver for import specifiers.
 * @returns Array of required prop names, or null if type cannot be resolved.
 */
export function getRequiredPropsFromType(
	typeName: string,
	componentContent: string,
	componentPath: string,
	resolver: PathResolver
): string[] | null {
	// 1. Try inline interface in the same file
	const inline = findInterfaceInSource(componentContent, typeName)
	if (inline) {
		return inline.required.length > 0 ? inline.required : null
	}

	// 2. Find type import in build script (type-only imports are not in analyzeBuildScriptForEditor)
	const buildScript = getBuildScriptContent(componentContent)
	if (!buildScript) return null

	// Check type imports: import type { MetaProps } from '@content/types/props'
	TYPE_IMPORT_REGEX.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = TYPE_IMPORT_REGEX.exec(buildScript)) !== null) {
		const importedNames = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim())
		const specifier = match[2]
		if (importedNames.includes(typeName)) {
			const resolved = resolver.resolve(specifier, componentPath)
			if (!resolved || !fs.existsSync(resolved)) return null
			const content = fs.readFileSync(resolved, 'utf-8')
			const parsed = findInterfaceInSource(content, typeName)
			if (parsed) {
				return parsed.required.length > 0 ? parsed.required : null
			}
		}
	}

	// Check value imports (in case type is re-exported with value)
	const { imports } = analyzeBuildScriptForEditor(buildScript)
	for (const imp of imports) {
		for (const { imported, local } of imp.namedBindings) {
			if (local === typeName || imported === typeName) {
				const resolved = resolver.resolve(imp.specifier, componentPath)
				if (!resolved || !fs.existsSync(resolved)) return null
				const content = fs.readFileSync(resolved, 'utf-8')
				const parsed = findInterfaceInSource(content, imported)
				if (parsed) {
					return parsed.required.length > 0 ? parsed.required : null
				}
			}
		}
	}
	return null
}

/**
 * Extract keys from an object literal string like `{ title, subtitle }` or `{ title: 'x', subtitle: 1 }`.
 * Uses lookahead so comma is not consumed, allowing the next key to match.
 */
export function getKeysFromObjectLiteral(literal: string): string[] {
	const keys: string[] = []
	// Match { or , (with spaces), then key; lookahead (?=\s*[,:}]) so we don't consume comma
	const keyRegex = /(?:\{\s*|,\s*)([A-Za-z_$][\w$]*)(?=\s*[,:}])/g
	let match: RegExpExecArray | null
	while ((match = keyRegex.exec(literal)) !== null) {
		keys.push(match[1])
	}
	return keys
}

/**
 * Get the props type name from a component's build script.
 */
export function getPropsTypeFromComponent(
	componentContent: string
): { typeName: string; isFromDestructuring: boolean } | null {
	const buildScript = getBuildScriptContent(componentContent)
	if (!buildScript) return null
	return getPropsTypeFromBuildScript(buildScript)
}

function getBuildScriptContent(htmlContent: string): string | null {
	SCRIPT_TAG_REGEX.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = SCRIPT_TAG_REGEX.exec(htmlContent)) !== null) {
		const attrs = (match[1] || '').toLowerCase()
		if (/\bsrc\s*=/.test(attrs)) continue
		if (!/\bis:build\b/.test(attrs)) continue
		return match[2]
	}
	return null
}
