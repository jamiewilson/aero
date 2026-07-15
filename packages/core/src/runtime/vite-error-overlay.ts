/**
 * Mount / clear Vite's `ErrorOverlay` from the Aero client HMR path.
 */

import type { ViteOverlayErrorPayload } from '@aero-js/diagnostics/browser'

const OVERLAY_TAG = 'vite-error-overlay'

type ErrorOverlayConstructor = new (
	err: ViteOverlayErrorPayload,
	links?: boolean
) => HTMLElement & { close?: () => void }

async function loadErrorOverlay(): Promise<ErrorOverlayConstructor> {
	const { ErrorOverlay } = (await import(/* @vite-ignore */ '/@vite/client')) as {
		ErrorOverlay: ErrorOverlayConstructor
	}
	return ErrorOverlay
}

/** Remove any open Vite error overlays. */
export function clearAeroViteErrorOverlay(): void {
	document.querySelectorAll(OVERLAY_TAG).forEach(node => {
		const el = node as HTMLElement & { close?: () => void }
		if (typeof el.close === 'function') el.close()
		else el.remove()
	})
}

/** Show Vite's ErrorOverlay for an SSR/runtime diagnostic payload. */
export async function showAeroViteErrorOverlay(err: ViteOverlayErrorPayload): Promise<void> {
	clearAeroViteErrorOverlay()
	const ErrorOverlay = await loadErrorOverlay()
	document.body.appendChild(new ErrorOverlay(err))
}
