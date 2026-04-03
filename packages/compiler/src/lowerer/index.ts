/**
 * Lowerer module exports.
 */

export { Lowerer } from './lowerer'
export { getEffectiveChildNodes, isTemplateElement } from './template'
export { parseElementAttributes, parseComponentAttributes } from './attributes'
export { compileConditionalChain, hasIfAttr } from './conditionals'
export { compileSlot, compileSlotDefaultContent, compileElementDefaultContent } from './slots'
export type { SlotDefaultContentDeps } from './slots'
export type { LowererDiag, ParsedElementAttrs, ParsedComponentAttrs } from './types'
