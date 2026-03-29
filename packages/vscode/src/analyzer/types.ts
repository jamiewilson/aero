import * as vscode from 'vscode'

/** A single variable definition from script analysis. */
export type VariableDefinition = {
	name: string
	range: vscode.Range
	kind: 'import' | 'declaration' | 'parameter' | 'reference'
	contentRef?: { alias: string; propertyPath: string[] }
	properties?: Set<string>
}

/** Scope introduced by a `for` / `data-for` attribute (`const … of …`). */
export type TemplateScope = {
	/** Bound names from the loop pattern (identifiers only; from compiler helper). */
	bindingNames: string[]
	sourceExpr: string
	sourceRoot: string
	sourceRange: vscode.Range
	startOffset: number
	endOffset: number
}

/** A variable reference found in template content or attributes. */
export type TemplateReference = {
	content: string
	range: vscode.Range
	offset: number
	isAttribute: boolean
	propertyPath?: string[]
	propertyRanges?: vscode.Range[]
	isComponent?: boolean
	isAlpine?: boolean
}

export type ScriptScope = 'build' | 'inline' | 'bundled' | 'blocking'
