/**
 * Extract top-level `<style>` bodies from an Aero template (same scope as compiler style extraction).
 */

import { parse } from '@aero-js/compiler'
import { parseHTML } from 'linkedom'

function isStyleElement(node: Node): node is Element {
	return node.nodeType === 1 && (node as Element).tagName === 'STYLE'
}

/** Text content of each direct child `<style>` under the template body (document order). */
export function extractTopLevelStyleBodies(htmlSource: string): string[] {
	const { template } = parse(htmlSource)
	const { document } = parseHTML(`<html lang="en"><body>${template}</body></html>`)
	if (!document.body) return []
	const bodies: string[] = []
	for (const node of Array.from(document.body.childNodes)) {
		if (!isStyleElement(node)) continue
		bodies.push(node.textContent ?? '')
	}
	return bodies
}
