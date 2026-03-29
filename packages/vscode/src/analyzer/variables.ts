import * as vscode from 'vscode'
import {
	iterateBuildScriptBindings,
	type BuildScriptBinding,
} from '@aero-js/compiler/build-scope-bindings'
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

	for (const block of scopeBlocks) {
		const content = block.content
		const contentStart = block.contentStart
		const rawAttrs = block.attrs

		if (scope === 'bundled') {
			const propsRegex = /(?:props|data-props)\s*=\s*(['"])([\s\S]*?)\1/gi
			let pdMatch: RegExpExecArray | null
			while ((pdMatch = propsRegex.exec(rawAttrs)) !== null) {
				const value = pdMatch[2]
				const valueStartInAttrs = pdMatch.index + pdMatch[0].indexOf(value)
				const rawAttrsStart = block.tagStart + '<script'.length
				const idRegex = /\b([a-zA-Z_$][\w$]*)\b/g
				let idMatch: RegExpExecArray | null
				while ((idMatch = idRegex.exec(value)) !== null) {
					const varName = idMatch[1]
					const varIndex = rawAttrsStart + valueStartInAttrs + idMatch.index
					setVar(varName, {
						name: varName,
						range: new vscode.Range(
							document.positionAt(varIndex),
							document.positionAt(varIndex + varName.length)
						),
						kind: 'reference',
					})
				}
			}
		}

		const skipImports = scope === 'inline'
		for (const b of iterateBuildScriptBindings(content, { skipImports })) {
			setVar(b.name, bindingToVariableDefinition(document, contentStart, b))
		}
	}

	return vars
}
