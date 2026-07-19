const NOT_PROSE_CLASS = 'not-prose'

function normalizeClasses(raw: unknown): string[] {
	if (Array.isArray(raw)) return [...raw]
	if (typeof raw === 'string') return raw.split(/\s+/).filter(Boolean)
	return []
}

function addClassToPre(node: { properties?: Record<string, unknown> }, className: string) {
	node.properties ??= {}
	const classes = [
		...normalizeClasses(node.properties.class),
		...normalizeClasses(node.properties.className),
	]
	if (!classes.includes(className)) classes.push(className)
	node.properties.class = classes
	delete node.properties.className
}

export function addPreNotProseReyhype() {
	return (tree: any) => {
		const visit = (node: any) => {
			if (node.type === 'element') {
				const classes = [
					...normalizeClasses(node.properties?.class),
					...normalizeClasses(node.properties?.className),
				]
				const isShikiSpan = node.tagName === 'span' && classes.includes('shiki')
				if (node.tagName === 'pre' || node.tagName === 'code' || isShikiSpan) {
					addClassToPre(node, NOT_PROSE_CLASS)
				}
			}
			node.children?.forEach(visit)
		}
		visit(tree)
	}
}
