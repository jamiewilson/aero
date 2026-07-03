/** Position in a template source file (VS Code–compatible shape). */
export interface SourcePosition {
	readonly line: number
	readonly character: number
}

/** Range in a template source file (VS Code–compatible shape). */
export interface SourceRange {
	readonly start: SourcePosition
	readonly end: SourcePosition
}

/** Minimal text document surface used by template diagnostic checks. */
export interface SourceDocument {
	readonly uri: { readonly fsPath: string }
	getText(): string
	positionAt(offset: number): SourcePosition
	offsetAt(position: SourcePosition): number
}

export function rangeFromOffsets(
	document: SourceDocument,
	start: number,
	end: number
): SourceRange {
	return {
		start: document.positionAt(start),
		end: document.positionAt(end),
	}
}
