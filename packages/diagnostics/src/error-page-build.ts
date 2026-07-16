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
	/** Vite plugin id for the overlay label when known (e.g. `@tailwindcss/vite:generate:serve`). */
	plugin?: string
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

function extractDiagnosticsPayload(html) {
	const marker = 'id="' + ${JSON.stringify(AERO_DIAGNOSTICS_SCRIPT_ID)} + '"';
	const start = html.indexOf(marker);
	if (start < 0) return '';
	const openEnd = html.indexOf('>', start);
	if (openEnd < 0) return '';
	// Build the close tag without a literal "<" + "/script>" sequence in this HTML module.
	const closeTag = '<' + '/script>';
	const close = html.indexOf(closeTag, openEnd);
	if (close < 0) return '';
	return html.slice(openEnd + 1, close).trim();
}

function diagnosticFingerprint(b64) {
	if (!b64) return '';
	try {
		const d = JSON.parse(atob(b64))[0];
		if (!d) return b64;
		return String(d.message || '') + '\\0' + String(d.file || '');
	} catch {
		return b64;
	}
}

async function fetchDevDocument() {
	try {
		const res = await fetch(location.href, {
			headers: { Accept: 'text/html' },
			cache: 'no-store',
		});
		const html = await res.text();
		return { ok: res.ok, html };
	} catch {
		return null;
	}
}

let reloadInFlight = false;
async function reloadWhenChanged() {
	if (reloadInFlight) return;
	const doc = await fetchDevDocument();
	if (!doc) return;
	const stillError = doc.html.includes(${JSON.stringify(AERO_OVERLAY_BOOTSTRAP_ATTR)});
	if (!stillError) {
		if (doc.ok) {
			reloadInFlight = true;
			location.reload();
		}
		return;
	}
	const nextPayload = extractDiagnosticsPayload(doc.html);
	const current =
		document.getElementById(${JSON.stringify(AERO_DIAGNOSTICS_SCRIPT_ID)})?.textContent?.trim() ??
		'';
	const nextFp = diagnosticFingerprint(nextPayload);
	const currentFp = diagnosticFingerprint(current);
	const shouldReload = Boolean(nextPayload) && nextFp !== currentFp;
	if (shouldReload) {
		reloadInFlight = true;
		location.reload();
	}
}

async function watchForRecovery() {
	// This page is served raw (never transformed by Vite), so import.meta.hot does not
	// exist here — create an HMR context manually to hear about updates and new errors.
	try {
		const vite = await import('/@vite/client');
		if (typeof vite.createHotContext === 'function') {
			const hot = vite.createHotContext('/__aero-dev-error__');
			hot.on('vite:afterUpdate', () => {
				void reloadWhenChanged();
			});
			hot.on('vite:error', () => {
				void reloadWhenChanged();
			});
		}
	} catch {}
	if (!RECOVER_MODULE) return;
	// Track the failing module for HMR; reload when SSR serves a real page or a new error.
	import(RECOVER_MODULE).then(
		() => {
			void reloadWhenChanged();
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
		? diagnosticToViteOverlayError(
				primary,
				options.plugin ?? 'vite-plugin-aero-transform'
			)
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
