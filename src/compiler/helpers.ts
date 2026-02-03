/**
 * Compiles a text node, handling TBD's interpolation syntax.
 * Replaces `{...}` with `${...}` for JS template literals.
 */
export function compileInterpolation(text: string): string {
	if (!text) return ''
	// Escape backticks to prevent breaking the template literal
	let compiled = text.replace(/`/g, '\\`')
	// Convert {expression} to ${expression}
	compiled = compiled.replace(/{([\s\S]+?)}/g, '${$1}')
	return compiled
}

/** Checks if an attribute name matches either 'attr' or 'data-attr' */
export function isAttr(name: string, attr: string, prefix: string): boolean {
	return name === attr || name === prefix + attr
}

/** Emits code for ${ items.map(item => `body`).join('') } without nested template literal escaping. */
export function emitMapJoin(items: string, item: string, body: string): string {
	return '${ ' + items + '.map(' + item + ' => `' + body + "`).join('') }"
}

/** Emits code for ${ condition ? `body` : '' } without nested template literal escaping. */
export function emitConditional(condition: string, body: string): string {
	return '${ ' + condition + ' ? `' + body + "` : '' }"
}

/** Escapes backticks in a string for safe embedding inside generated template literals. */
export function escapeBackticks(s: string): string {
	return s.replace(/`/g, '\\`')
}

/** Emits code for slots['name'] || `defaultContent` without nested template literal escaping. */
export function emitSlotFallback(slotName: string, defaultContent: string): string {
	return "${ slots['" + slotName + "'] || `" + defaultContent + '` }'
}

/** Emits code for a slots object { "name": `content` } without nested template literal escaping. */
export function emitSlotsObject(slotsMap: Record<string, string>): string {
	const entries = Object.entries(slotsMap)
		.map(([k, v]) => '"' + k + '": `' + v + '`')
		.join(', ')
	return '{ ' + entries + ' }'
}

/** Emits the top-level render function wrapper (script + template return). */
export function emitRenderFunction(script: string, templateCode: string): string {
	return `export default async function(tbd) {
		const { site, slots = {}, renderComponent } = tbd;
		${script}
		return \`${templateCode}\`;
	}`.trim()
}
