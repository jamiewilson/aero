/**
 * Diagnostic check: cross-file prop validation for components and layouts.
 */
import * as vscode from 'vscode'
import * as fs from 'node:fs'
import { COMPONENT_SUFFIX_REGEX } from '../constants'
import { applyAeroDiagnosticIdentity } from '../diagnostic-metadata'
import type { PathResolver } from '../pathResolver'
import type { VariableDefinition } from '../analyzer'
import { kebabToCamelCase, collectImportedSpecifiersFromDocument } from '../utils'
import { getRequiredPropsFromType, getPropsTypeFromComponent } from '../propsValidation'
import { getIgnoredRanges, isInRanges } from './helpers'

/** Matches opening tags with component/layout suffix */
const COMPONENT_TAG_OPEN_REGEX =
	/<([a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:component|layout))\b[^>]*\/?>/gi

/** Matches props="{ ...varName }" to extract the variable name. */
const PROPS_SPREAD_REGEX = /\{\s*\.\.\.\s*([A-Za-z_$][\w$]*)\s*\}/

/** Maximum layout chain depth to prevent infinite loops. */
const MAX_LAYOUT_CHAIN_DEPTH = 10

export function checkComponentProps(
	document: vscode.TextDocument,
	text: string,
	diagnostics: vscode.Diagnostic[],
	resolver: PathResolver,
	definedVars: Map<string, VariableDefinition>
): void {
	const imports = collectImportedSpecifiersFromDocument(text)
	const ignoredRanges = getIgnoredRanges(text)

	COMPONENT_TAG_OPEN_REGEX.lastIndex = 0
	let match: RegExpExecArray | null

	while ((match = COMPONENT_TAG_OPEN_REGEX.exec(text)) !== null) {
		const tagStart = match.index
		if (isInRanges(tagStart, ignoredRanges)) continue

		const tagName = match[1]
		const attrs = match[0].slice(1 + tagName.length, -1).trim()
		const suffixMatch = COMPONENT_SUFFIX_REGEX.exec(tagName)
		if (!suffixMatch) continue

		const baseName = tagName.replace(COMPONENT_SUFFIX_REGEX, '')
		const importName = kebabToCamelCase(baseName)
		const importedSpecifier = imports.get(importName)
		if (!importedSpecifier) continue

		const rawResolved = resolver.resolve(importedSpecifier, document.uri.fsPath)
		const resolvedPath =
			rawResolved &&
			(fs.existsSync(rawResolved)
				? rawResolved
				: !rawResolved.endsWith('.html') && fs.existsSync(rawResolved + '.html')
					? rawResolved + '.html'
					: null)
		if (!resolvedPath) continue

		const suffix = suffixMatch[1] as string

		// Layout with attributes: trace chain to sink component
		if (suffix === 'layout') {
			const attrKeys = getAttributeKeysFromTag(attrs)
			if (attrKeys.length > 0) {
				const sink = traceLayoutToSinkProps(resolvedPath, resolver)
				if (sink?.requiredProps?.length) {
					const missing = sink.requiredProps.filter(req => !attrKeys.includes(req))
					if (missing.length > 0) {
						pushPropDiagnostic(
							document,
							diagnostics,
							tagStart,
							match[0].length,
							missing,
							baseName,
							suffix
						)
					}
				}
			}
			continue
		}

		// Component: check props="{ ...varName }"
		const componentContent = fs.readFileSync(resolvedPath, 'utf-8')
		const propsType = getPropsTypeFromComponent(componentContent)
		if (!propsType) continue

		const requiredProps = getRequiredPropsFromType(
			propsType.typeName,
			componentContent,
			resolvedPath,
			resolver
		)
		if (!requiredProps || requiredProps.length === 0) continue

		const propsSpreadMatch = attrs.match(/(?:^|\s)(?:data-)?props\s*=\s*["']([^"']*)["']/)
		if (propsSpreadMatch) {
			const value = propsSpreadMatch[1].trim()
			const spreadVar = value.match(PROPS_SPREAD_REGEX)?.[1]
			if (spreadVar) {
				const def = definedVars.get(spreadVar)
				const passedKeys = def?.properties ? Array.from(def.properties) : []
				const missing = requiredProps.filter(req => !passedKeys.includes(req))
				if (missing.length > 0) {
					pushPropDiagnostic(
						document,
						diagnostics,
						tagStart,
						match[0].length,
						missing,
						baseName,
						suffix
					)
				}
			}
		}
	}
}

function pushPropDiagnostic(
	document: vscode.TextDocument,
	diagnostics: vscode.Diagnostic[],
	tagStart: number,
	tagLength: number,
	missing: string[],
	baseName: string,
	suffix: string
): void {
	const startPos = document.positionAt(tagStart)
	const endPos = document.positionAt(tagStart + tagLength)
	const msg =
		missing.length === 1
			? `Missing required prop '${missing[0]}' for ${baseName}-${suffix}`
			: `Missing required props: ${missing.map(m => `'${m}'`).join(', ')} for ${baseName}-${suffix}`
	const diagnostic = new vscode.Diagnostic(
		new vscode.Range(startPos, endPos),
		msg,
		vscode.DiagnosticSeverity.Error
	)
	applyAeroDiagnosticIdentity(diagnostic, 'AERO_COMPILE', 'props.md')
	diagnostics.push(diagnostic)
}

/** Extract attribute names from a tag's attribute string, excluding Aero directives. */
function getAttributeKeysFromTag(attrs: string): string[] {
	const keys: string[] = []
	const skipAttrs = new Set([
		'props',
		'data-props',
		'if',
		'data-if',
		'else-if',
		'data-else-if',
		'for',
		'data-for',
		'slot',
		'data-slot',
	])
	const attrRegex = /\b([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\s*=/gi
	let m: RegExpExecArray | null
	attrRegex.lastIndex = 0
	while ((m = attrRegex.exec(attrs)) !== null) {
		const name = m[1].toLowerCase()
		if (name.startsWith('data-')) continue
		if (skipAttrs.has(name)) continue
		keys.push(name)
	}
	return keys
}

/**
 * Trace a layout file to find the sink component that consumes props.
 * Follows layout -> layout -> component chain (e.g. sub -> base -> meta).
 */
function traceLayoutToSinkProps(
	layoutPath: string,
	resolver: PathResolver
): { requiredProps: string[] } | null {
	const visited = new Set<string>()
	let currentPath = layoutPath
	for (let i = 0; i < MAX_LAYOUT_CHAIN_DEPTH; i++) {
		if (visited.has(currentPath)) break
		visited.add(currentPath)
		const content = fs.readFileSync(currentPath, 'utf-8')
		// Find child that receives props
		const childMatch = content.match(
			/<([a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:component|layout))\b[^>]*\b(?:data-)?props\b[^>]*\/?>/i
		)
		if (!childMatch) break
		const childTag = childMatch[1]
		const childBase = childTag.replace(COMPONENT_SUFFIX_REGEX, '')
		const childImport = kebabToCamelCase(childBase)
		const imports = collectImportedSpecifiersFromDocument(content)
		const spec = imports.get(childImport)
		if (!spec) break
		const childResolved = resolver.resolve(spec, currentPath)
		const childPath =
			childResolved &&
			(fs.existsSync(childResolved)
				? childResolved
				: !childResolved.endsWith('.html') && fs.existsSync(childResolved + '.html')
					? childResolved + '.html'
					: null)
		if (!childPath) break
		if (childTag.endsWith('-component')) {
			const compContent = fs.readFileSync(childPath, 'utf-8')
			const propsType = getPropsTypeFromComponent(compContent)
			if (!propsType) return null
			const required = getRequiredPropsFromType(
				propsType.typeName,
				compContent,
				childPath,
				resolver
			)
			return required?.length ? { requiredProps: required } : null
		}
		currentPath = childPath
	}
	return null
}
