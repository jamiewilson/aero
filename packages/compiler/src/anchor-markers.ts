/** HTML comment anchor markers for reactive bindings (shared contract with @aero-js/reactivity). */

export type AnchorDirective = 'if' | 'for' | 'text' | 'switch'

export type IRAnchorMode = 'element' | 'comment-range'

export function emitCommentStart(directive: AnchorDirective, bindId: number): string {
	return `<!-- aero:${directive}:${bindId} -->`
}

export function emitCommentEnd(directive: AnchorDirective, bindId: number): string {
	return `<!-- /aero:${directive}:${bindId} -->`
}

export function dataAeroAttr(directive: 'if' | 'for' | 'switch' | 'text', bindId: number): string {
	return `data-aero-${directive}="${bindId}"`
}
