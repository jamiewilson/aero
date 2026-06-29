import { parseSync } from 'oxc-parser'

export interface ReadonlyReactivePropWrite {
	readonly name: string
	readonly range?: [number, number]
}

const EXPRESSION_FILENAME = 'template-event.ts'
const EXPRESSION_PARSE_OPTIONS = {
	sourceType: 'module',
	range: true,
	lang: 'ts',
} as const

export function readonlyReactivePropWriteMessage(name: string): string {
	return `Reactive prop \`${name}\` is readonly; declare it with \`Aero.bindable()\` in the child and pass it with \`bind:${name}="{ ... }"\` from the parent to allow mutation.`
}

function walk(node: unknown, visit: (node: any) => void): void {
	if (!node || typeof node !== 'object') return
	visit(node)
	for (const value of Object.values(node as Record<string, unknown>)) {
		if (!value) continue
		if (Array.isArray(value)) {
			for (const item of value) walk(item, visit)
			continue
		}
		if (typeof value === 'object') walk(value, visit)
	}
}

function nodeRange(node: unknown): [number, number] | undefined {
	const range = (node as { range?: unknown })?.range
	if (
		Array.isArray(range) &&
		range.length === 2 &&
		typeof range[0] === 'number' &&
		typeof range[1] === 'number'
	) {
		return [range[0], range[1]]
	}
	const start = (node as { start?: unknown })?.start
	const end = (node as { end?: unknown })?.end
	if (typeof start === 'number' && typeof end === 'number') return [start, end]
	return undefined
}

export function collectReadonlyReactivePropWrites(
	program: unknown,
	readonlyReactivePropNames: ReadonlySet<string>
): ReadonlyReactivePropWrite[] {
	const writes: ReadonlyReactivePropWrite[] = []
	walk(program, node => {
		if (node?.type === 'AssignmentExpression' && node.left?.type === 'Identifier') {
			const name = node.left.name
			if (readonlyReactivePropNames.has(name)) {
				writes.push({ name, range: nodeRange(node.left) ?? nodeRange(node) })
			}
		}
		if (node?.type === 'UpdateExpression' && node.argument?.type === 'Identifier') {
			const name = node.argument.name
			if (readonlyReactivePropNames.has(name)) {
				writes.push({ name, range: nodeRange(node.argument) ?? nodeRange(node) })
			}
		}
	})
	return writes
}

export function collectReadonlyReactivePropWritesInExpression(
	expression: string,
	readonlyReactivePropNames: ReadonlySet<string>
): ReadonlyReactivePropWrite[] {
	if (readonlyReactivePropNames.size === 0 || !expression.trim()) return []
	const source = expression.trimEnd().endsWith(';') ? expression : `${expression};`
	const parsed = parseSync(EXPRESSION_FILENAME, source, EXPRESSION_PARSE_OPTIONS)
	if (parsed.errors.length > 0) return []
	return collectReadonlyReactivePropWrites(parsed.program, readonlyReactivePropNames)
}
