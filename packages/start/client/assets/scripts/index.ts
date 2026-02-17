import htmx from '@scripts/htmx'
import Alpine from '@scripts/alpine'

htmx.onLoad(node => Alpine.initTree(node as HTMLElement))
htmx.process(document.body)
