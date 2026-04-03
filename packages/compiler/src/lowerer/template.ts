/**
 * HTML `<template>` helpers for the template → IR lowerer.
 *
 * @remarks
 * **DOM:** Spec-compliant `HTMLTemplateElement` exposes inner nodes on `template.content`, not
 * necessarily the same as `template.childNodes`. Always use {@link getEffectiveChildNodes} when
 * deciding which children to compile for a node that might be `<template>`.
 *
 * **Linkedom:** May mirror children on both `childNodes` and `content`; we still read from
 * `content` when present so behavior matches browsers and the spec.
 *
 * **Wrapperless vs literal:** Conditional chains lower each branch with `compileWrapperAwareBranch`
 * (wrapperless `<template>` via `compileWrapperlessNode`). `data-for` / `for` on `<template>` use
 * `compileWrapperlessNode` for the loop body. A literal `<template>` without those directives
 * still passes through `compileElement` (see `lowerer.ts`).
 */

import * as CONST from '../constants'

/**
 * Whether `node` is a `<template>` element (`HTMLTemplateElement`).
 * Uses {@link CONST.TAG_TEMPLATE}; keep detection centralized here.
 */
export function isTemplateElement(node: any): boolean {
	return (
		node?.nodeType === 1 &&
		typeof node.tagName === 'string' &&
		node.tagName.toLowerCase() === CONST.TAG_TEMPLATE
	)
}

/**
 * Returns the child `NodeList` that lowering should traverse for this node's inner markup.
 *
 * - Non-template elements: `node.childNodes`.
 * - `<template>`: `template.content.childNodes` when `content` exists; otherwise falls back to
 *   `node.childNodes`.
 */
export function getEffectiveChildNodes(node: any): NodeList | undefined {
	if (!node) return undefined
	if (isTemplateElement(node)) {
		const content = node.content as DocumentFragment | undefined
		if (content?.childNodes) {
			return content.childNodes
		}
		return node.childNodes
	}
	return node.childNodes
}
