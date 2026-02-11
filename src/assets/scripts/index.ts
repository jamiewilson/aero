import htmx from '~/src/assets/scripts/htmx'
import Alpine from '~/src/assets/scripts/alpine'

htmx.onLoad(node => Alpine.initTree(node as HTMLElement))
htmx.process(document.body)
