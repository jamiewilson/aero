import '@styles/global.css'

import tbd from '~/src'
import htmx from '@scripts/htmx'
import Alpine from '@scripts/alpine'

htmx.onLoad(node => Alpine.initTree(node as HTMLElement))

tbd.mount({
	onRender: root => htmx.process(root),
})
