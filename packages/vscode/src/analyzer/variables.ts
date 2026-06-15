import * as vscode from 'vscode'
import {
	iterateBuildScriptBindings,
	type BuildScriptBinding,
} from '@aero-js/compiler/build-scope-bindings'
import { parsePropsAttributeBindings } from '@aero-js/compiler'
import { parseScriptBlocks } from '../script-tag'
import { isInsideHtmlComment } from './helpers'
import type { ScriptScope, VariableDefinition } from './types'

function bindingToVariableDefinition(
	document: vscode.TextDocument,
	contentStart: number,
	b: BuildScriptBinding
): VariableDefinition {
	const kind = b.kind === 'import' ? 'import' : 'declaration'
	const def: VariableDefinition = {
		name: b.name,
		range: new vscode.Range(
			document.positionAt(contentStart + b.start),
			document.positionAt(contentStart + b.end)
		),
		kind,
	}
	if (b.properties && b.properties.size > 0) {
		def.properties = new Set(b.properties)
	}
	return def
}

export function collectDefinedVariables(
	document: vscode.TextDocument,
	text: string
): [
	Map<string, VariableDefinition>,
	Array<{ name: string; kind1: string; kind2: string; range: vscode.Range }>,
] {
	const vars = new Map<string, VariableDefinition>()
	const duplicates: Array<{
		name: string
		kind1: string
		kind2: string
		range: vscode.Range
	}> = []

	const setVar = (name: string, def: VariableDefinition) => {
		const existing = vars.get(name)
		if (existing) {
			duplicates.push({
				name,
				kind1: existing.kind,
				kind2: def.kind,
				range: def.range,
			})
		}
		vars.set(name, def)
	}

	const buildBlocks = parseScriptBlocks(text).filter(
		b => b.kind === 'build' && !isInsideHtmlComment(text, b.tagStart)
	)

	for (const block of buildBlocks) {
		const content = block.content
		const contentStart = block.contentStart
		for (const b of iterateBuildScriptBindings(content)) {
			setVar(b.name, bindingToVariableDefinition(document, contentStart, b))
		}
	}

	return [vars, duplicates]
}

function buildBindingPropertiesFromVars(
	vars: Map<string, VariableDefinition>
): Map<string, ReadonlySet<string>> {
	const out = new Map<string, ReadonlySet<string>>()
	for (const [name, def] of vars) {
		if (def.properties && def.properties.size > 0) {
			out.set(name, def.properties)
		}
	}
	return out
}

function addPropsInjectedVars(
	document: vscode.TextDocument,
	block: { attrs: string; tagStart: number },
	buildBindingProperties: Map<string, ReadonlySet<string>>,
	setVar: (name: string, def: VariableDefinition) => void
): void {
	const parsed = parsePropsAttributeBindings(block.attrs, buildBindingProperties)
	if (parsed.injectedNames.length === 0) return

	const propsMatch = block.attrs.match(/(?:props|data-props)\s*=\s*(['"])([\s\S]*?)\1/i)
	const attrsStart = block.tagStart + '<script'.length

	for (const name of parsed.injectedNames) {
		let rangeStart = attrsStart
		if (propsMatch) {
			const value = propsMatch[2]
			const idx = value.indexOf(name)
			if (idx >= 0) {
				const valueStart =
					attrsStart + propsMatch.index! + propsMatch[0].indexOf(propsMatch[1] + value + propsMatch[1]) + 1
				rangeStart = valueStart + idx
			}
		}

		setVar(name, {
			name,
			range: new vscode.Range(
				document.positionAt(rangeStart),
				document.positionAt(rangeStart + name.length)
			),
			kind: 'reference',
		})
	}
}

export function collectVariablesByScope(
	document: vscode.TextDocument,
	text: string,
	scope: ScriptScope
): Map<string, VariableDefinition> {
	const vars = new Map<string, VariableDefinition>()

	const setVar = (name: string, def: VariableDefinition) => {
		vars.set(name, def)
	}

	const scopeBlocks = parseScriptBlocks(text).filter(
		b => b.kind === scope && !isInsideHtmlComment(text, b.tagStart)
	)

	const buildBindingProperties =
		scope === 'build'
			? buildBindingPropertiesFromVars(vars)
			: buildBindingPropertiesFromVars(
					collectDefinedVariables(document, text)[0]
				)

	for (const block of scopeBlocks) {
		const content = block.content
		const contentStart = block.contentStart

		if (scope === 'bundled' || scope === 'inline' || scope === 'blocking') {
			addPropsInjectedVars(document, block, buildBindingProperties, setVar)
		}

		const skipImports = scope === 'inline'
		for (const b of iterateBuildScriptBindings(content, { skipImports })) {
			setVar(b.name, bindingToVariableDefinition(document, contentStart, b))
		}
	}

	return vars
}
