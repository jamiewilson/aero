/**
 * Aero-specific codegen target.
 *
 * @remarks
 * This target is used by the Aero framework to generate render functions
 * that use the Aero runtime (Aero class with page, site, props, etc.).
 */

import * as Helper from '@aero-js/compiler/helpers'
import type { CodegenTarget } from '@aero-js/compiler'

/**
 * Default codegen target for the Aero framework.
 */
export const AeroTarget: CodegenTarget = {
	renderFunctionName: 'Aero',
	contextProperties: ['slots', 'renderComponent'],
	renderComponentCall: 'Aero.renderComponent',
	internalContextKeys: Helper.RENDER_INTERNAL_CONTEXT_KEYS,
	forwardPageAndSite: true,
	emitRenderWrapper: Helper.emitRenderFunction,
}
