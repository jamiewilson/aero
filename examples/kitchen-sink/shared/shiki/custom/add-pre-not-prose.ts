import type { ShikiTransformer } from 'shiki'

/**
 * Add `not-prose` to the generated `<pre>` element.
 *
 * @remarks
 * Opt-in helper for Tailwind Typography: prose skips elements with `not-prose`.
 * Uses Shiki's `addClassToHast` so classes merge with Shiki's own `pre` classes.
 */
export function addPreNotProseShiki(): ShikiTransformer {
	return {
		name: 'aero-js:pre-not-prose-transformer',
		pre(node) {
			this.addClassToHast(node, 'not-prose')
		},
	}
}

export function addPreNotProseReyhype() {
	return (tree: any) => {
		const visit = (node: any) => {
			if (node.type === 'element' && node.tagName === 'pre') {
				node.properties ??= {}
				const raw = node.properties.className
				const classes = Array.isArray(raw)
					? [...raw]
					: typeof raw === 'string'
						? raw.split(/\s+/).filter(Boolean)
						: []
				if (!classes.includes('not-prose')) {
					node.properties.className = [...classes, 'not-prose']
				}
			}
			node.children?.forEach(visit)
		}
		visit(tree)
	}
}
