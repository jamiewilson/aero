/**
 * Shared types for the template → IR lowerer (attributes, slots, conditionals).
 */

/** Optional original template source + file path for directive diagnostics. */
export type LowererDiag = { source: string; file?: string } | undefined

/** Result of parsing a generic element's attributes: attribute string for output, optional loop data, optional props expr. */
export interface ParsedElementAttrs {
	attrString: string
	loopData: { binding: string; items: string } | null
	/** Discriminant from `switch` / `data-switch="{ … }"` when present. */
	switchExpr: string | null
	passDataExpr: string | null
}

/** Result of parsing a component's attributes: props object code string (with optional spread). */
export interface ParsedComponentAttrs {
	propsString: string
}
