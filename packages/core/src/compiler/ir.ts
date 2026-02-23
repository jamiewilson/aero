/**
 * Intermediate representation (IR) for Aero codegen.
 *
 * @remarks
 * Templates are lowered from DOM to a list of IR nodes, then a single emitter
 * turns IR into JS strings. This enables easier directives, optimization,
 * debugging, and future alternate backends (e.g. streaming).
 */

/** Single node in the IR; emitter switches on `kind`. */
export type IRNode =
	| IRAppend
	| IRFor
	| IRIf
	| IRSlot
	| IRSlotVar
	| IRComponent
	| IRScriptPassData
	| IRStylePassData

/** Chunk of HTML/text (template literal content). */
export interface IRAppend {
	kind: 'Append'
	content: string
	outVar?: string
}

/** Loop: for (const item of items) { body }. */
export interface IRFor {
	kind: 'For'
	item: string
	items: string
	body: IRNode[]
}

/** Conditional with optional else-if/else chain. */
export interface IRIf {
	kind: 'If'
	condition: string
	body: IRNode[]
	elseIf?: { condition: string; body: IRNode[] }[]
	else?: IRNode[]
}

/** Output slot with default content (slots['name'] ?? defaultContent). */
export interface IRSlot {
	kind: 'Slot'
	name: string
	defaultContent: string
	outVar?: string
}

/** Declare slot accumulator: let varName = ''; */
export interface IRSlotVar {
	kind: 'SlotVar'
	varName: string
}

/** Child component render: slots are named lists of IR; slotVarMap maps slot name to accumulator var. */
export interface IRComponent {
	kind: 'Component'
	baseName: string
	propsString: string
	slots: Record<string, IRNode[]>
	slotVarMap: Record<string, string>
	outVar?: string
}

/** Inject pass:data into a script tag. */
export interface IRScriptPassData {
	kind: 'ScriptPassData'
	passDataExpr: string
	isModule: boolean
	outVar: string
}

/** Inject pass:data into a style tag (CSS custom properties). */
export interface IRStylePassData {
	kind: 'StylePassData'
	passDataExpr: string
	outVar: string
}

/** Top-level result of lowering: body and style as separate IR streams. */
export interface BodyAndStyleIR {
	body: IRNode[]
	style: IRNode[]
}
