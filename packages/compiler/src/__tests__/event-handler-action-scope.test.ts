import { describe, expect, it, vi } from 'vitest'
import {
	HYPERMEDIA_EVENT_HANDLER_ACTIONS,
	HYPERMEDIA_HTTP_METHODS,
	HYPERMEDIA_SIGNAL_RESOLVER,
	buildHypermediaActionScopeDecl,
} from '../event-handler-action-scope'
import { createEventHandlerActionScope } from '../create-event-handler-action-scope'

describe('event-handler-action-scope', () => {
	it('lists HTTP methods and signal resolver', () => {
		expect(HYPERMEDIA_EVENT_HANDLER_ACTIONS).toEqual([
			...HYPERMEDIA_HTTP_METHODS,
			HYPERMEDIA_SIGNAL_RESOLVER,
		])
	})

	it('builds editor prelude for every action-scope name', () => {
		const decl = buildHypermediaActionScopeDecl()
		for (const name of HYPERMEDIA_EVENT_HANDLER_ACTIONS) {
			expect(decl).toContain(`declare function ${name}`)
		}
	})

	it('createEventHandlerActionScope exposes the shared contract', () => {
		const runtime = { executeAction: vi.fn() }
		const scope = createEventHandlerActionScope(
			runtime,
			() => undefined,
			() => ({ value: false })
		)
		expect(Object.keys(scope).sort()).toEqual([...HYPERMEDIA_EVENT_HANDLER_ACTIONS].sort())
	})
})
