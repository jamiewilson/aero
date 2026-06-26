/**
 * Shared types for the template → IR lowerer (attributes, slots, conditionals).
 */

/** Optional original template source + file path for directive diagnostics. */
export type LowererDiag =
	| {
			source: string
			file?: string
			onWarning?: (warning: {
				code: 'AERO_TEMPLATE' | 'AERO_SWITCH'
				message: string
				line?: number
				column?: number
			}) => void
	  }
	| undefined

/** Result of parsing a generic element's attributes: attribute string for output, optional loop data, optional props expr. */
export interface ParsedElementAttrs {
	attrString: string
	loopData: { binding: string; items: string; keyExpr?: string } | null
	/** Discriminant from `switch` / `data-switch="{ … }"` when present. */
	switchExpr: string | null
	passDataExpr: string | null
	eventBinds: import('../ir').IRReactiveEventBind[]
	textBinds: import('../ir').IRReactiveTextBind[]
	busyBinds: import('../ir').IRReactiveBusyBind[]
	showBinds: import('../ir').IRReactiveShowBind[]
	htmlBinds: import('../ir').IRReactiveHtmlBind[]
	classBinds: import('../ir').IRReactiveClassBind[]
	propertyBinds: import('../ir').IRReactivePropertyBind[]
	modelBinds: import('../ir').IRReactiveModelBind[]
}

export interface LowererReactiveState {
	readonly bindingNames: ReadonlySet<string>
	readonly writableBindingNames: ReadonlySet<string>
	nextTextBindId(): number
	nextEventBindId(): number
	nextBusyBindId(): number
	nextComponentBindId(): number
	nextShowBindId(): number
	nextHtmlBindId(): number
	nextClassBindId(): number
	nextPropertyBindId(): number
	nextModelBindId(): number
	nextIfBindId(): number
	nextForBindId(): number
	nextSwitchBindId(): number
}

/** Result of parsing a component's attributes: props object code string (with optional spread). */
export interface ParsedComponentAttrs {
	propsString: string
}
