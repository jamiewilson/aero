import * as vscode from 'vscode'
import {
	collectBuildScriptContentGlobalReferences,
	collectDefinedVariables,
	collectTemplateReferences,
	collectTemplateScopes,
	collectVariablesByScope,
	type ScriptScope,
	type TemplateReference,
	type TemplateScope,
	type VariableDefinition,
} from './analyzer'
import { CONTENT_GLOBALS } from './constants'
import { parseScriptBlocks, type ParsedScriptBlock } from './script-tag'

export type DuplicateDeclaration = {
	name: string
	kind1: string
	kind2: string
	range: vscode.Range
}

export type VariablesByScope = Record<ScriptScope, Map<string, VariableDefinition>>

export type ScriptContentByScope = Record<ScriptScope, string>

export interface ParsedDocument {
	text: string
	scriptBlocks: ParsedScriptBlock[]
	definedVariables: Map<string, VariableDefinition>
	duplicateDeclarations: DuplicateDeclaration[]
	variablesByScope: VariablesByScope
	templateScopes: TemplateScope[]
	templateReferences: TemplateReference[]
	buildContentGlobalReferences: TemplateReference[]
	scriptContentByScope: ScriptContentByScope
}

export function parseDocument(document: vscode.TextDocument): ParsedDocument {
	const text = document.getText()
	const scriptBlocks = parseScriptBlocks(text)
	const [definedVariables, duplicateDeclarations] = collectDefinedVariables(document, text)
	const templateScopes = collectTemplateScopes(document, text)
	const templateReferences = collectTemplateReferences(document, text)
	const contentGlobalNames = new Set(Object.keys(CONTENT_GLOBALS))
	const buildContentGlobalReferences = collectBuildScriptContentGlobalReferences(
		document,
		text,
		contentGlobalNames
	)

	const variablesByScope: VariablesByScope = {
		build: collectVariablesByScope(document, text, 'build'),
		bundled: collectVariablesByScope(document, text, 'bundled'),
		inline: collectVariablesByScope(document, text, 'inline'),
		blocking: collectVariablesByScope(document, text, 'blocking'),
	}

	const scriptContentByScope: ScriptContentByScope = {
		build: scriptBlocks
			.filter(block => block.kind === 'build')
			.map(block => block.content)
			.join(' '),
		bundled: scriptBlocks
			.filter(block => block.kind === 'bundled')
			.map(block => block.content)
			.join(' '),
		inline: scriptBlocks
			.filter(block => block.kind === 'inline')
			.map(block => block.content)
			.join(' '),
		blocking: scriptBlocks
			.filter(block => block.kind === 'blocking')
			.map(block => block.content)
			.join(' '),
	}

	return {
		text,
		scriptBlocks,
		definedVariables,
		duplicateDeclarations,
		variablesByScope,
		templateScopes,
		templateReferences,
		buildContentGlobalReferences,
		scriptContentByScope,
	}
}
