import type { SourceRange } from '../source-document'

/** A single variable definition from script analysis. */
export type VariableDefinition = {
	name: string
	range: SourceRange
	kind: 'import' | 'declaration' | 'parameter' | 'reference'
	contentRef?: { alias: string; propertyPath: string[] }
	properties?: Set<string>
}

/** Scope introduced by a `for` / `data-for` attribute (`const … of …`). */
export type TemplateScope = {
	bindingNames: string[]
	sourceExpr: string
	sourceRoot: string
	sourceRange: SourceRange
	startOffset: number
	endOffset: number
}

/** A variable reference found in template content or attributes. */
export type TemplateReference = {
	content: string
	range: SourceRange
	offset: number
	isAttribute: boolean
	propertyPath?: string[]
	propertyRanges?: SourceRange[]
	isComponent?: boolean
	isAlpine?: boolean
}

export type ScriptScope = 'build' | 'state' | 'inline' | 'bundled' | 'blocking'
