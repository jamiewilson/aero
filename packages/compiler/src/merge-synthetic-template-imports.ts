/**
 * Auto-import layout/component templates referenced in markup but not in `<script is:build>`.
 */

import type { BuildScriptImport } from './build-script-analysis'
import { camelToKebabCase } from './helpers'
import type { IRNode } from './ir'
import {
	formatResolveTemplateTagError,
	resolveTemplateTag,
	type TemplateTagIndex,
	type TemplateTagKind,
} from './template-tag-index'
import { CompileError, type CompileOptions } from './types'
import { buildTemplateTagIndex } from './template-tag-index'

export type ComponentUsageFromIR = {
	readonly baseName: string
	readonly kind: TemplateTagKind
}

/** Collect unique component/layout render bindings from lowered template IR. */
export function collectComponentUsagesFromIR(nodes: IRNode[]): ComponentUsageFromIR[] {
	const seen = new Map<string, ComponentUsageFromIR>()

	function walk(irNodes: IRNode[]): void {
		for (const node of irNodes) {
			if (node.kind === 'Component') {
				const kind: TemplateTagKind = node.isLayout ? 'layout' : 'component'
				if (!seen.has(node.baseName)) {
					seen.set(node.baseName, { baseName: node.baseName, kind })
				}
				for (const slotIR of Object.values(node.slots)) {
					walk(slotIR)
				}
				continue
			}
			if (node.kind === 'For' || node.kind === 'If') {
				walk(node.body)
				if (node.kind === 'If') {
					for (const branch of node.elseIf ?? []) walk(branch.body)
					if (node.else) walk(node.else)
				}
				continue
			}
			if (node.kind === 'Switch') {
				for (const branch of node.cases) walk(branch.body)
				if (node.defaultBody) walk(node.defaultBody)
			}
		}
	}

	walk(nodes)
	return [...seen.values()]
}

/** Resolve tag index for compile when auto-import is enabled. */
export function resolveTemplateTagIndexForCompile(
	options: CompileOptions
): TemplateTagIndex | undefined {
	if (options.templateAutoImport === false) return undefined
	if (options.templateTagIndex) return options.templateTagIndex
	if (options.componentsDir && options.layoutsDir) {
		return buildTemplateTagIndex({
			componentsDir: options.componentsDir,
			layoutsDir: options.layoutsDir,
			componentsAlias: options.componentsAlias,
			layoutsAlias: options.layoutsAlias,
		})
	}
	return undefined
}

/**
 * Append synthetic default imports for markup tags not covered by author build-script imports.
 */
export function mergeSyntheticTemplateImports(
	authorBuildImports: readonly BuildScriptImport[],
	bodyIR: IRNode[],
	options: CompileOptions,
	index: TemplateTagIndex
): BuildScriptImport[] {
	const authorBindings = new Set(
		authorBuildImports.map(imp => imp.defaultBinding).filter((name): name is string => name != null)
	)
	const syntheticByBinding = new Map<string, BuildScriptImport>()
	const syntheticBySpecifier = new Set<string>()

	for (const { baseName, kind } of collectComponentUsagesFromIR(bodyIR)) {
		if (authorBindings.has(baseName)) continue

		const tagBase = camelToKebabCase(baseName)
		const resolved = resolveTemplateTag(index, kind, tagBase)
		if (resolved.status !== 'ok') {
			throw new CompileError({
				message: formatResolveTemplateTagError(resolved),
				file: options.importer,
			})
		}

		const specifier = resolved.entry.specifier
		if (syntheticByBinding.has(baseName) || syntheticBySpecifier.has(specifier)) continue

		const imp: BuildScriptImport = {
			specifier,
			defaultBinding: baseName,
			namedBindings: [],
			namespaceBinding: null,
		}
		syntheticByBinding.set(baseName, imp)
		syntheticBySpecifier.add(specifier)
	}

	return [...authorBuildImports, ...syntheticByBinding.values()]
}
