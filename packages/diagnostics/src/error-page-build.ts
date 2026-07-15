/**
 * Build dev SSR error HTML (Node). Returns a minimal Vite overlay bootstrap shell.
 */

import {
	diagnosticToViteOverlayError,
	type ViteOverlayErrorPayload,
} from './vite-overlay-error'
import {
	AERO_DIAGNOSTICS_SCRIPT_ID,
	AERO_OVERLAY_BOOTSTRAP_ATTR,
	diagnosticsForWire,
} from './wire-format'
import type { AeroDiagnostic } from './types'

export { AERO_OVERLAY_BOOTSTRAP_ATTR }
export { diagnosticToViteOverlayError, type ViteOverlayErrorPayload } from './vite-overlay-error'

export interface BuildDevSsrErrorHtmlOptions {
	/**
	 * Client module URL for the failing template (e.g. `/client/pages/x.html`).
	 * Imported so Vite tracks the module for HMR recovery after a fix.
	 */
	recoverModuleId?: string
}

function buildOverlayBootstrapScript(
	overlayError: ViteOverlayErrorPayload,
	recoverModuleId: string | undefined
): string {
	return `const OVERLAY_ERROR = ${JSON.stringify(overlayError).replace(/</g, '\\u003c')};
const RECOVER_MODULE = ${JSON.stringify(recoverModuleId ?? null)};
const FALLBACK_MS = 4000;
let overlayShown = false;

function readDiagnostics() {
	const el = document.getElementById(${JSON.stringify(AERO_DIAGNOSTICS_SCRIPT_ID)});
	if (!el?.textContent?.trim()) return [];
	try {
		return JSON.parse(atob(el.textContent.trim()));
	} catch {
		return [];
	}
}

function showFallback() {
	if (overlayShown) return;
	const status = document.getElementById('aero-dev-error-status');
	const fallback = document.getElementById('aero-dev-error-fallback');
	if (!status || !fallback) return;
	const diagnostics = readDiagnostics();
	const d = diagnostics[0];
	if (!d) {
		status.textContent = 'Aero Compile Error';
		return;
	}
	status.textContent = 'Aero Compile Error';
	const file = d.file;
	const loc = d.span ? (file + ':' + d.span.line + ':' + d.span.column) : file;
	fallback.hidden = false;
	fallback.textContent = loc ? (d.message + '\\n' + loc) : d.message;
}

async function showViteOverlay() {
	const { ErrorOverlay } = await import('/@vite/client');
	document.body.appendChild(new ErrorOverlay(OVERLAY_ERROR));
	overlayShown = true;
	const status = document.getElementById('aero-dev-error-status');
	if (status) status.hidden = true;
}

async function pageIsHealthy() {
	try {
		const res = await fetch(location.href, {
			headers: { Accept: 'text/html' },
			cache: 'no-store',
		});
		if (!res.ok) return false;
		const html = await res.text();
		return !html.includes(${JSON.stringify(AERO_OVERLAY_BOOTSTRAP_ATTR)});
	} catch {
		return false;
	}
}

async function reloadWhenFixed() {
	if (await pageIsHealthy()) location.reload();
}

function watchForRecovery() {
	if (import.meta.hot) {
		import.meta.hot.on('vite:afterUpdate', () => {
			void reloadWhenFixed();
		});
	}
	if (!RECOVER_MODULE) return;
	// Track the failing module for HMR; only reload once SSR serves a real page.
	import(/* @vite-ignore */ RECOVER_MODULE).then(
		() => {
			void reloadWhenFixed();
		},
		() => {}
	);
}

async function bootstrap() {
	const fallbackTimer = setTimeout(showFallback, FALLBACK_MS);
	try {
		await showViteOverlay();
		clearTimeout(fallbackTimer);
	} catch {
		showFallback();
	}
	watchForRecovery();
}

bootstrap();`
}

/**
 * Minimal dev error document: mounts Vite's ErrorOverlay, keeps a tiny fallback shell.
 */
export function buildDevSsrErrorHtml(
	diagnostics: readonly AeroDiagnostic[],
	options: BuildDevSsrErrorHtmlOptions = {}
): string {
	const wire = diagnosticsForWire(diagnostics)
	const b64 = Buffer.from(JSON.stringify(wire), 'utf-8').toString('base64')
	const primary = wire[0]
	const overlayError = primary
		? diagnosticToViteOverlayError(primary, 'vite-plugin-aero-transform')
		: {
				message: '[AERO_COMPILE] Unknown Aero compile error',
				stack: '',
			}
	const bootstrapScript = buildOverlayBootstrapScript(overlayError, options.recoverModuleId)

	return `<!doctype html>
<html lang="en" ${AERO_OVERLAY_BOOTSTRAP_ATTR}>
	<head>
		<meta charset="utf-8" />
		<title>Aero Compile Error</title>
		<style>
			body {
				font-family: system-ui, sans-serif;
				margin: 0;
				padding: 2rem;
				color: #aaa;
				background: #0c1117;
			}
			#aero-dev-error-fallback {
				margin-top: 0.75rem;
				color: #fff;
				max-width: 48rem;
				word-break: break-word;
				white-space: pre-wrap;
				font-family: ui-monospace, monospace;
				font-size: 0.875rem;
			}
		</style>
	</head>
	<body>
		<p id="aero-dev-error-status">Aero Compile Error: Loading overlay...</p>
		<p id="aero-dev-error-fallback" hidden></p>
		<script type="text/plain" id="${AERO_DIAGNOSTICS_SCRIPT_ID}">
${b64}
		</script>
		<script type="module">
${bootstrapScript}
		</script>
	</body>
</html>`
}
