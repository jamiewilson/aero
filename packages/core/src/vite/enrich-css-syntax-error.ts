/**
 * Recover original CSS file/line for Tailwind CssSyntaxError when the Vite plugin
 * drops location (URL-rewrite parse runs without compile `from`).
 */

export type { EnrichCssSyntaxErrorOptions } from './css-syntax-error-probe'
export { enrichCssSyntaxError } from './css-syntax-error-probe'
export { collectClientStyleCssFiles } from './collect-client-style-css'
