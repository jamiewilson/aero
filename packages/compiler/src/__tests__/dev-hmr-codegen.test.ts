import { describe, expect, it } from 'vitest'
import { emitDevHmrPageRegistration } from '../dev-hmr-codegen'

describe('emitDevHmrPageRegistration', () => {
	it('registers default export and mountStateBindings with per-page HMR accept', () => {
		const code = emitDevHmrPageRegistration('/client/pages/demos/form-model.html', {
			hasMountStateBindings: true,
			hasGetStaticPaths: false,
		})
		expect(code).toContain('virtual:aero/runtime-hub.ts')
		expect(code).toContain('/client/pages/demos/form-model.html')
		expect(code).toContain('{ default: __aeroPageRender, mountStateBindings }')
		expect(code).toContain('import.meta.hot.accept')
	})
})
