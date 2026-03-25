import * as vscode from 'vscode'
import { analyzeBuildScriptForEditor } from '@aero-js/core/editor'
import { parseScriptBlocks } from '../script-tag'
import { isInsideHtmlComment, maskJsComments } from './helpers'
import type { ScriptScope, VariableDefinition } from './types'

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
		const maskedContent = maskJsComments(content)

		try {
			const { imports: editorImports } = analyzeBuildScriptForEditor(content)
			for (const imp of editorImports) {
				const bindingRanges = imp.bindingRanges ?? {}
				for (const [localName, range] of Object.entries(bindingRanges)) {
					const [start, end] = range as [number, number]
					setVar(localName, {
						name: localName,
						range: new vscode.Range(
							document.positionAt(contentStart + start),
							document.positionAt(contentStart + end)
						),
						kind: 'import',
					})
				}
			}
		} catch {
			// Parse error in build script; skip imports for this block
		}

		const simpleDeclRegex =
			/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*[\w.$<>,\s\[\]|{}]+)?\s*=\s*(\{[\s\S]*?\})?/g
		let declMatch: RegExpExecArray | null
		while ((declMatch = simpleDeclRegex.exec(maskedContent)) !== null) {
			const name = declMatch[1]
			const initializer = declMatch[2]
			const start = contentStart + declMatch.index + declMatch[0].indexOf(name)

			const def: VariableDefinition = {
				name,
				range: new vscode.Range(
					document.positionAt(start),
					document.positionAt(start + name.length)
				),
				kind: 'declaration',
			}

			if (initializer) {
				const properties = new Set<string>()
				const keyRegex = /([A-Za-z_$][\w$]*)\s*:/g
				let keyMatch: RegExpExecArray | null
				while ((keyMatch = keyRegex.exec(initializer)) !== null) {
					properties.add(keyMatch[1])
				}
				const shorthandRegex = /(?:\{|,)\s*([A-Za-z_$][\w$]*)\s*(?:,|\})/g
				while ((keyMatch = shorthandRegex.exec(initializer)) !== null) {
					properties.add(keyMatch[1])
				}

				if (properties.size > 0) {
					def.properties = properties
				}
			}

			setVar(name, def)
		}

		const destructuringRegex = /\b(?:const|let|var)\s+\{([^}]+)\}\s*=/g
		while ((declMatch = destructuringRegex.exec(maskedContent)) !== null) {
			const body = declMatch[1]
			const bodyStart = contentStart + declMatch.index + declMatch[0].indexOf(body)

			const parts = body.split(',')
			let currentOffset = 0
			for (const part of parts) {
				const trimmed = part.trim()
				if (!trimmed) {
					currentOffset += part.length + 1
					continue
				}

				const colonIndex = trimmed.indexOf(':')
				let localName = trimmed
				if (colonIndex > -1) {
					localName = trimmed.slice(colonIndex + 1).trim()
				}

				const partIndex = body.indexOf(part, currentOffset)
				const localIndex = part.lastIndexOf(localName)
				const absStart = bodyStart + partIndex + localIndex

				if (localName) {
					setVar(localName, {
						name: localName,
						range: new vscode.Range(
							document.positionAt(absStart),
							document.positionAt(absStart + localName.length)
						),
						kind: 'declaration',
					})
				}
				currentOffset = partIndex + part.length
			}
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
		const maskedContent = maskJsComments(content)

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

		if (scope !== 'inline') {
			try {
				const { imports: editorImports } = analyzeBuildScriptForEditor(content)
				for (const imp of editorImports) {
					const bindingRanges = imp.bindingRanges ?? {}
					for (const [localName, range] of Object.entries(bindingRanges)) {
						const [start, end] = range as [number, number]
						setVar(localName, {
							name: localName,
							range: new vscode.Range(
								document.positionAt(contentStart + start),
								document.positionAt(contentStart + end)
							),
							kind: 'import',
						})
					}
				}
			} catch {
				// Parse error; skip imports for this block
			}
		}

		const simpleDeclRegex = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(\{[\s\S]*?\})?/g
		let declMatch: RegExpExecArray | null
		while ((declMatch = simpleDeclRegex.exec(maskedContent)) !== null) {
			const name = declMatch[1]
			const initializer = declMatch[2]
			const start = contentStart + declMatch.index + declMatch[0].indexOf(name)

			const def: VariableDefinition = {
				name,
				range: new vscode.Range(
					document.positionAt(start),
					document.positionAt(start + name.length)
				),
				kind: 'declaration',
			}

			if (initializer) {
				const properties = new Set<string>()
				const keyRegex = /([A-Za-z_$][\w$]*)\s*:/g
				let keyMatch: RegExpExecArray | null
				while ((keyMatch = keyRegex.exec(initializer)) !== null) {
					properties.add(keyMatch[1])
				}
				const shorthandRegex = /(?:\{|,)\s*([A-Za-z_$][\w$]*)\s*(?:,|\})/g
				while ((keyMatch = shorthandRegex.exec(initializer)) !== null) {
					properties.add(keyMatch[1])
				}
				if (properties.size > 0) {
					def.properties = properties
				}
			}

			setVar(name, def)
		}

		const destructuringRegex = /\b(?:const|let|var)\s+\{([^}]+)\}\s*=/g
		while ((declMatch = destructuringRegex.exec(maskedContent)) !== null) {
			const body = declMatch[1]
			const bodyStart = contentStart + declMatch.index + declMatch[0].indexOf(body)

			const parts = body.split(',')
			let currentOffset = 0
			for (const part of parts) {
				const trimmed = part.trim()
				if (!trimmed) {
					currentOffset += part.length + 1
					continue
				}

				const colonIndex = trimmed.indexOf(':')
				let localName = trimmed
				if (colonIndex > -1) {
					localName = trimmed.slice(colonIndex + 1).trim()
				}

				const partIndex = body.indexOf(part, currentOffset)
				const localIndex = part.lastIndexOf(localName)
				const absStart = bodyStart + partIndex + localIndex

				if (localName) {
					setVar(localName, {
						name: localName,
						range: new vscode.Range(
							document.positionAt(absStart),
							document.positionAt(absStart + localName.length)
						),
						kind: 'declaration',
					})
				}
				currentOffset = partIndex + part.length
			}
		}
	}

	return vars
}
