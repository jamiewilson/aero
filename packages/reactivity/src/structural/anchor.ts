/** Anchor strategy for reactive structural bindings (no injected wrapper elements). */

export type StructuralAnchorKind = 'element' | 'comment-range'

export interface StructuralAnchorElement {
	readonly kind: 'element'
	readonly selector: string
}

export type StructuralAnchorCommentRange = {
	readonly kind: 'comment-range'
	readonly bindId: number
	readonly directive: 'if' | 'for' | 'text' | 'switch'
}

export type StructuralAnchor = StructuralAnchorElement | StructuralAnchorCommentRange

export function commentStartMarker(directive: 'if' | 'for' | 'text' | 'switch', bindId: number): string {
	return ` aero:${directive}:${bindId} `
}

export function commentEndMarker(directive: 'if' | 'for' | 'text' | 'switch', bindId: number): string {
	return ` /aero:${directive}:${bindId} `
}

export function emitCommentStart(directive: 'if' | 'for' | 'text' | 'switch', bindId: number): string {
	return `<!--${commentStartMarker(directive, bindId)}-->`
}

export function emitCommentEnd(directive: 'if' | 'for' | 'text' | 'switch', bindId: number): string {
	return `<!--${commentEndMarker(directive, bindId)}-->`
}

function isCommentNode(node: Node): node is Comment {
	return node.nodeType === 8
}

function commentText(node: Comment): string {
	return node.data.trim()
}

export function isCommentStart(
	node: Node,
	directive: 'if' | 'for' | 'text' | 'switch',
	bindId: number
): boolean {
	return isCommentNode(node) && commentText(node) === `aero:${directive}:${bindId}`
}

export function isCommentEnd(
	node: Node,
	directive: 'if' | 'for' | 'text' | 'switch',
	bindId: number
): boolean {
	return isCommentNode(node) && commentText(node) === `/aero:${directive}:${bindId}`
}

export interface CommentRange {
	readonly parent: ParentNode
	readonly start: Comment
	readonly end: Comment
}

export function findCommentRange(
	root: ParentNode,
	directive: 'if' | 'for' | 'text' | 'switch',
	bindId: number
): CommentRange | null {
	const doc = (root as Node).ownerDocument ?? globalThis.document
	const walker = doc.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
	let start: Comment | null = null
	while (walker.nextNode()) {
		const node = walker.currentNode as Comment
		if (isCommentStart(node, directive, bindId)) {
			start = node
			break
		}
	}
	if (!start?.parentNode) return null

	let end: Comment | null = null
	const siblingWalker = doc.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
	while (siblingWalker.nextNode()) {
		const node = siblingWalker.currentNode as Comment
		if (isCommentEnd(node, directive, bindId)) {
			end = node
			break
		}
	}
	if (!end?.parentNode || start.parentNode !== end.parentNode) return null
	return { parent: start.parentNode, start, end }
}

/** Remove all nodes strictly between `start` and `end` comment siblings. */
export function clearCommentRange(range: CommentRange): void {
	let cursor: ChildNode | null = range.start.nextSibling
	while (cursor && cursor !== range.end) {
		const next = cursor.nextSibling
		cursor.remove()
		cursor = next
	}
}

/** Replace nodes between comment markers with parsed HTML content. */
export function setCommentRangeHtml(range: CommentRange, html: string): ParentNode {
	clearCommentRange(range)
	const doc = (range.parent as Node).ownerDocument ?? globalThis.document
	const template = doc.createElement('template')
	template.innerHTML = html.trim()
	const fragment = template.content
	range.end.parentNode?.insertBefore(fragment, range.end)
	return range.parent
}

/** Replace nodes between comment markers with a document fragment. */
export function setCommentRangeFragment(range: CommentRange, fragment: DocumentFragment): void {
	clearCommentRange(range)
	range.end.parentNode?.insertBefore(fragment, range.end)
}

export interface CommentRangeMountTarget {
	readonly kind: 'comment-range'
	readonly range: CommentRange
}

export interface ElementMountTarget {
	readonly kind: 'element'
	readonly element: Element
}

export type MountTarget = ElementMountTarget | CommentRangeMountTarget

export function resolveElementAnchor(root: ParentNode, selector: string): Element | null {
	const el = root as Element
	if (typeof el.matches === 'function' && el.matches(selector)) return el
	return el.querySelector?.(selector) ?? null
}

export function resolveMountTarget(
	root: ParentNode,
	anchor: StructuralAnchor
): MountTarget | null {
	if (anchor.kind === 'element') {
		const element = resolveElementAnchor(root, anchor.selector)
		return element ? { kind: 'element', element } : null
	}
	const range = findCommentRange(root, anchor.directive, anchor.bindId)
	return range ? { kind: 'comment-range', range } : null
}

export function setMountTargetHtml(target: MountTarget, html: string): ParentNode {
	if (target.kind === 'element') {
		target.element.innerHTML = html
		return target.element
	}
	return setCommentRangeHtml(target.range, html)
}

export function replaceMountTargetChildren(
	target: MountTarget,
	fragment: DocumentFragment
): void {
	if (target.kind === 'element') {
		target.element.replaceChildren(fragment)
		return
	}
	setCommentRangeFragment(target.range, fragment)
}

export function setCommentRangeText(range: CommentRange, text: string): void {
	clearCommentRange(range)
	const doc = (range.parent as Node).ownerDocument ?? globalThis.document
	const textNode = doc.createTextNode(text)
	range.end.parentNode?.insertBefore(textNode, range.end)
}

export function setMountTargetText(target: MountTarget, text: string): void {
	if (target.kind === 'element') {
		target.element.textContent = text
		return
	}
	setCommentRangeText(target.range, text)
}

export function clearMountTarget(target: MountTarget): void {
	if (target.kind === 'element') {
		target.element.innerHTML = ''
		return
	}
	clearCommentRange(target.range)
}
