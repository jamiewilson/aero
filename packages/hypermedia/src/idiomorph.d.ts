declare module 'idiomorph' {
	export const Idiomorph: {
		morph(
			existingNode: Element | Document,
			newContent: Element | Node | HTMLCollection | Node[] | string | null,
			config?: {
				morphStyle?: 'outerHTML' | 'innerHTML'
				ignoreActive?: boolean
				ignoreActiveValue?: boolean
				restoreFocus?: boolean
				callbacks?: {
					beforeNodeMorphed?: (oldNode: Node, newNode: Node) => boolean
				}
			}
		): undefined | Node[]
	}
}
