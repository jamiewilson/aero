/**
 * Minimal compile surface for Node-only checks (e.g. `aero check`).
 *
 * @remarks
 * Kept separate from the browser entry so consumers do not pull codegen into client bundles.
 */
export { compileTemplate } from './compiler/codegen'
