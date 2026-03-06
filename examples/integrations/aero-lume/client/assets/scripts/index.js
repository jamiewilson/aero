import aero from '@aero-js/core'
import { state, bindDom } from 'lume-js'
import { show } from 'lume-js/handlers'

const store = state({ name: '' })

aero.mount({
	onRender(el) {
		bindDom(el, store, {
			handlers: [show],
		})
	},
})
