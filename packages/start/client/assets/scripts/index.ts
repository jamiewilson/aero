import htmx from 'htmx.org'
import Alpine from '@scripts/alpine'

htmx.config.globalViewTransitions = true
htmx.onLoad(node => Alpine.initTree(node as HTMLElement))
htmx.process(document.body)
