import type { AeroDiagnostic } from '@aero-js/diagnostics'
import { pushOffsetDiagnostic, pushSpanDiagnostic } from '../aero-diagnostic-build'
import { rangeFromOffsets, type SourceDocument, type SourceRange } from '../source-document'
/**
 * Diagnostic check: cross-file prop validation for components and layouts.
 */
import * as fs from 'node:fs'
import path from 'node:path'
import { COMPONENT_SUFFIX_REGEX } from '../constants'
import type { PathResolver } from '../path-resolver'
import type { VariableDefinition } from '../analyzer'
import { kebabToCamelCase, collectImportedSpecifiersFromDocument } from '../utils'
import { isValidTemplateImportSpecifier } from '../importResolution'
import { getRequiredPropsFromType, getPropsTypeFromComponent } from '../propsValidation'
import { analyzeStateScript, collectComponentReactivePropMetadata } from '@aero-js/compiler'
import { isBuildDirectiveName } from '@aero-js/compiler/build-directive-attributes'
import { getIgnoredRanges, isInRanges, attributeSectionBase, findAttributeRange, findTagNameRange, sliceRawAttrs, type ByteRange } from './helpers'

/** Matches opening tags with component/layout suffix */
const COMPONENT_TAG_OPEN_REGEX =
	/<([a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:component|layout))\b[^>]*\/?>/gi

/** Matches props="{ ...varName }" to extract the variable name. */
const PROPS_SPREAD_REGEX = /\{\s*\.\.\.\s*([A-Za-z_$][\w$]*)\s*\}/

/** Bare props attribute (no value) — equivalent to props="{ ...props }". */
const BARE_PROPS_ATTR_REGEX = /(?:^|\s)(?:(?:data-aero-|aero-)?props)(?!\s*=)(?:\s|\/|$)/

/** Maximum layout chain depth to prevent infinite loops. */
const MAX_LAYOUT_CHAIN_DEPTH = 10

/**
 * Resolve the variable name spread via a props attribute, or null when not a spread.
 * Bare `props` / prefixed props (no value) maps to local variable `props`.
 */
export function resolvePropsSpreadVariable(attrs: string): string | null {
	const propsSpreadMatch = attrs.match(
		/(?:^|\s)(?:(?:data-aero-|aero-)?props)\s*=\s*["']([^"']*)["']/
	)
	if (propsSpreadMatch) {
		const value = propsSpreadMatch[1].trim()
		return value.match(PROPS_SPREAD_REGEX)?.[1] ?? null
	}
	if (BARE_PROPS_ATTR_REGEX.test(attrs)) {
		return 'props'
	}
	return null
}

function validateSpreadProps(
	document: SourceDocument,
	diagnostics: AeroDiagnostic[],
	tagStart: number,
	tagLength: number,
	spreadVar: string,
	requiredProps: string[],
	definedVars: Map<string, VariableDefinition>,
	baseName: string,
	suffix: string
): void {
	const def = definedVars.get(spreadVar)
	const passedKeys = def?.properties ? Array.from(def.properties) : []
	const missing = requiredProps.filter(req => !passedKeys.includes(req))
	if (missing.length > 0) {
		pushPropDiagnostic(document, diagnostics, tagStart, tagLength, missing, baseName, suffix)
	}
}

export function checkComponentProps(
	document: SourceDocument,
	text: string,
	diagnostics: AeroDiagnostic[],
	resolver: PathResolver,
	definedVars: Map<string, VariableDefinition>,
	stateVars: Map<string, VariableDefinition> = new Map()
): void {
	const imports = collectImportedSpecifiersFromDocument(text)
	const ignoredRanges = getIgnoredRanges(text)

	COMPONENT_TAG_OPEN_REGEX.lastIndex = 0
	let match: RegExpExecArray | null

	while ((match = COMPONENT_TAG_OPEN_REGEX.exec(text)) !== null) {
		const tagStart = match.index
		if (isInRanges(tagStart, ignoredRanges)) continue

		const tagName = match[1]
		const fullTag = match[0]
		const attrs = fullTag.slice(1 + tagName.length, -1).trim()
		const suffixMatch = COMPONENT_SUFFIX_REGEX.exec(tagName)
		if (!suffixMatch) continue

		const baseName = tagName.replace(COMPONENT_SUFFIX_REGEX, '')
		const importName = kebabToCamelCase(baseName)
		const importedSpecifier = imports.get(importName)
		if (!importedSpecifier || !isValidTemplateImportSpecifier(importedSpecifier)) continue

		const rawResolved = resolver.resolve(importedSpecifier, document.uri.fsPath)
		const resolvedPath =
			rawResolved && fs.existsSync(rawResolved) ? rawResolved : null
		if (!resolvedPath) continue

		const suffix = suffixMatch[1] as string
		if (suffix === 'component') {
			validateComponentReactiveProps(
				document,
				diagnostics,
				tagStart,
				fullTag,
				tagName,
				baseName,
				importName,
				resolvedPath,
				stateVars
			)
		}

		// Layout: trace chain to sink component; validate bare/spread props or individual attrs
		if (suffix === 'layout') {
			const sink = traceLayoutToSinkProps(resolvedPath, resolver)
			if (sink?.requiredProps?.length) {
				const spreadVar = resolvePropsSpreadVariable(attrs)
				if (spreadVar) {
					validateSpreadProps(
						document,
						diagnostics,
						tagStart,
						match[0].length,
						spreadVar,
						sink.requiredProps,
						definedVars,
						baseName,
						suffix
					)
				} else {
					const attrKeys = getAttributeKeysFromTag(attrs)
					if (attrKeys.length > 0) {
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

		const spreadVar = resolvePropsSpreadVariable(attrs)
		if (spreadVar) {
			validateSpreadProps(
				document,
				diagnostics,
				tagStart,
				match[0].length,
				spreadVar,
				requiredProps,
				definedVars,
				baseName,
				suffix
			)
		}
	}
}

function getPassedReactivePropNames(
	attrs: string,
	stateVars: Map<string, VariableDefinition>
): Map<string, { bound: boolean; obsoleteReadonly: boolean; rawAttrName: string }> {
	const passed = new Map<
		string,
		{ bound: boolean; obsoleteReadonly: boolean; rawAttrName: string }
	>()
	const attrRegex =
		/(?:^|\s)([A-Za-z_:][A-Za-z0-9_:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
	let m: RegExpExecArray | null
	attrRegex.lastIndex = 0
	while ((m = attrRegex.exec(attrs)) !== null) {
		const rawName = m[1]
		const value = (m[2] ?? m[3] ?? '').trim()
		const expr = value.match(/^\{\s*([A-Za-z_$][\w$]*)\s*\}$/)?.[1]
		if (!expr || !stateVars.has(expr)) continue
		const bound = rawName.startsWith('bind:')
		const obsoleteReadonly = rawName.endsWith(':readonly')
		const propName = bound
			? rawName.slice('bind:'.length)
			: obsoleteReadonly
				? rawName.slice(0, -':readonly'.length)
				: rawName
		passed.set(propName, { bound, obsoleteReadonly, rawAttrName: rawName })
	}
	return passed
}

function collectStateScriptContent(componentContent: string): string {
	const scripts: string[] = []
	const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
	let match: RegExpExecArray | null
	while ((match = scriptRegex.exec(componentContent)) !== null) {
		if (/\bis:state\b/.test(match[1])) scripts.push(match[2])
	}
	return scripts.join('\n')
}

function collectWrittenReactivePropNames(componentContent: string): Set<string> {
	const stateScript = collectStateScriptContent(componentContent)
	if (!stateScript.trim()) return new Set()
	const written = new Set<string>()
	for (const binding of analyzeStateScript(stateScript).bindings) {
		if (binding.reactiveProp && binding.writes) written.add(binding.name)
	}
	return written
}

function collectBindableReactivePropNames(componentContent: string): Set<string> {
	const stateScript = collectStateScriptContent(componentContent)
	const bindable = new Set<string>()
	const destructureRegex = /\bconst\s*\{([\s\S]*?)\}\s*=\s*Aero\.props\b/g
	let match: RegExpExecArray | null
	while ((match = destructureRegex.exec(stateScript)) !== null) {
		for (const rawPart of match[1].split(',')) {
			const part = rawPart.trim()
			if (!part || !/\bAero\.bindable\s*\(/.test(part)) continue
			const local = (part.includes(':') ? part.split(':').pop() : part)
				?.split('=')[0]
				?.trim()
			if (local && /^[A-Za-z_$][\w$]*$/.test(local)) bindable.add(local)
		}
	}
	return bindable
}

function validateComponentReactiveProps(
	document: SourceDocument,
	diagnostics: AeroDiagnostic[],
	tagStart: number,
	fullTag: string,
	tagName: string,
	baseName: string,
	importName: string,
	resolvedPath: string,
	stateVars: Map<string, VariableDefinition>
): void {
	if (stateVars.size === 0) return
	let metadata: ReturnType<typeof collectComponentReactivePropMetadata>
	try {
		metadata = collectComponentReactivePropMetadata(path.dirname(resolvedPath))
	} catch {
		return
	}
	const reactiveProps = metadata[importName] ?? metadata[baseName] ?? []
	if (reactiveProps.length === 0) return

	const rawAttrs = sliceRawAttrs(tagName, fullTag)
	const attrBase = attributeSectionBase(tagStart, tagName)
	const passed = getPassedReactivePropNames(rawAttrs, stateVars)
	const componentContent = fs.readFileSync(resolvedPath, 'utf-8')
	const writtenReactiveProps = collectWrittenReactivePropNames(componentContent)
	const bindableReactiveProps = collectBindableReactivePropNames(componentContent)
	for (const reactiveProp of reactiveProps) {
		const propName = reactiveProp.propName || reactiveProp.name
		const passedProp = passed.get(propName)
		const metadataWrites = (reactiveProp as typeof reactiveProp & { writes?: boolean }).writes === true
		const metadataBindable = (reactiveProp as typeof reactiveProp & { bindable?: boolean }).bindable === true
		if (passedProp?.obsoleteReadonly === true) {
			pushReactivePropDiagnostic(
				document,
				diagnostics,
				tagStart,
				tagName,
				rawAttrs,
				attrBase,
				passedProp.rawAttrName,
				`Component reactive prop \`${propName}:readonly\` is obsolete; use \`${propName}="{ ... }"\` because reactive props are readonly by default.`
			)
			continue
		}
		if (passedProp?.bound === true && !metadataBindable && !bindableReactiveProps.has(reactiveProp.name)) {
			pushReactivePropDiagnostic(
				document,
				diagnostics,
				tagStart,
				tagName,
				rawAttrs,
				attrBase,
				passedProp.rawAttrName,
				`Child prop \`${propName}\` for <${tagName}> must be declared with \`Aero.bindable()\` before it can be passed with \`bind:${propName}\`.`
			)
			continue
		}
		if ((metadataWrites || writtenReactiveProps.has(reactiveProp.name)) && passedProp && !passedProp.bound) {
			pushReactivePropDiagnostic(
				document,
				diagnostics,
				tagStart,
				tagName,
				rawAttrs,
				attrBase,
				passedProp.rawAttrName,
				`Reactive prop \`${propName}\` for <${tagName}> is readonly; use \`bind:${propName}="{ ... }"\` to allow child mutation.`
			)
			continue
		}
		if (!reactiveProp.required) continue
		if (passedProp) continue
		pushReactivePropDiagnostic(
			document,
			diagnostics,
			tagStart,
			tagName,
			rawAttrs,
			attrBase,
			null,
			`Required reactive prop \`${propName}\` for <${tagName}> must be passed as a state signal.`
		)
	}
}

function reactivePropDiagnosticRange(
	tagStart: number,
	tagName: string,
	rawAttrs: string,
	attrBase: number,
	rawAttrName: string | null
): ByteRange {
	if (rawAttrName) {
		const attrRange = findAttributeRange(rawAttrs, attrBase, rawAttrName)
		if (attrRange) return attrRange
	}
	return findTagNameRange(tagStart, tagName)
}

function pushReactivePropDiagnostic(
	document: SourceDocument,
	diagnostics: AeroDiagnostic[],
	tagStart: number,
	tagName: string,
	rawAttrs: string,
	attrBase: number,
	rawAttrName: string | null,
	message: string
): void {
	const range = reactivePropDiagnosticRange(tagStart, tagName, rawAttrs, attrBase, rawAttrName)
	pushOffsetDiagnostic(diagnostics, document, range.start, range.end, message, 'AERO_COMPILE', 'error')
}

function pushPropDiagnostic(
	document: SourceDocument,
	diagnostics: AeroDiagnostic[],
	tagStart: number,
	tagLength: number,
	missing: string[],
	baseName: string,
	suffix: string
): void {
	const msg =
		missing.length === 1
			? `Missing required prop '${missing[0]}' for ${baseName}-${suffix}`
			: `Missing required props: ${missing.map(m => `'${m}'`).join(', ')} for ${baseName}-${suffix}`
	pushOffsetDiagnostic(
		diagnostics,
		document,
		tagStart,
		tagStart + tagLength,
		msg,
		'AERO_COMPILE',
		'error'
	)
}

/** Extract attribute names from a tag's attribute string, excluding Aero directives. */
function getAttributeKeysFromTag(attrs: string): string[] {
	const keys: string[] = []
	const skipAttrs = new Set(['slot', 'data-slot'])
	const attrRegex = /\b([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\s*=/gi
	let m: RegExpExecArray | null
	attrRegex.lastIndex = 0
	while ((m = attrRegex.exec(attrs)) !== null) {
		const name = m[1].toLowerCase()
		if (isBuildDirectiveName(name)) continue
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
			childResolved && fs.existsSync(childResolved) ? childResolved : null
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
