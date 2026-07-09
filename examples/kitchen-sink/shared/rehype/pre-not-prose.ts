/**
 *
 * @returns Rehype plugin
 * @description Add `not-prose` class to the generated `<pre>` element.
 * @example
 * ```
 * <pre class="not-prose">
 *   <code>
 *     <span>Hello, world!</span>
 *   </code>
 * </pre>
 * ```
 */
export default function preNotProse() {
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
