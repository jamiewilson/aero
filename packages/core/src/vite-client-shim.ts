/** Type shim for Vite dev client; runtime resolves via Vite, not this file. */
export class ErrorOverlay extends HTMLElement {
	constructor(_err: unknown, _links?: boolean) {
		super()
	}
	close?(): void
}
