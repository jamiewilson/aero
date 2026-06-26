import { describe, expect, it } from 'vitest'
import { bindKeyedFor } from '../structural/for'
import { createStateScope } from '../state-scope'
import { SignalStore } from '../store'

describe('bindKeyedFor destructuring', () => {
	it('exposes destructured loop bindings in row scope for keyExpr', () => {
		const store = new SignalStore()
		store.merge({ items: [{ id: 'alpha' }, { id: 'beta' }] })
		const scope = createStateScope({
			store,
			bindings: [{ name: 'items', derived: false, initExpr: '[]', dependencies: [] }],
			functionSources: [],
		})

		const template = {
			innerHTML: '',
			content: { firstElementChild: { remove() {} } as Element },
		} as unknown as HTMLTemplateElement

		const fragmentNodes: Element[] = []
		const doc = {
			createElement: () => template,
			createDocumentFragment: () =>
				({
					appendChild(node: Element) {
						fragmentNodes.push(node)
					},
				}) as unknown as DocumentFragment,
		}

		let rowCount = 0
		const container = {
			ownerDocument: doc,
			replaceChildren(fragment: DocumentFragment) {
				rowCount = fragmentNodes.length
			},
		} as unknown as Element

		const cleanup = bindKeyedFor({
			container,
			scope,
			itemsExpr: 'items',
			keyExpr: 'id',
			binding: '{ id }',
			bindingNames: ['id'],
			renderRow: () => ({
				key: 'unused',
				renderHtml: () => '<li></li>',
				mountRow: () => () => {},
			}),
		})

		expect(rowCount).toBe(2)
		cleanup()
	})
})
