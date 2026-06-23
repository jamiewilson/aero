import { describe, expect, it } from 'vitest'
import { compile } from '../../codegen'
import { parse } from '../../parser'

const mockOptions = {
	root: '/',
	resolvePath: (v: string, _importer: string) => v,
	importer: '/',
}

describe('state reactive codegen (PR-2d)', () => {
	it('emits mountStateBindings for reactive text interpolations', () => {
		const html = `<script is:state>
			let count = 1
			let doubled = count * 2
		</script>
		<div>{ count }-{ doubled }</div>`

		const code = compile(parse(html), mockOptions)

		expect(code).toContain("import { mountStateBindings as __aeroMountStateBindings } from '@aero-js/reactivity'")
		expect(code).toContain('export function mountStateBindings(root, Aero, opts = {})')
		expect(code).toContain('data-aero-text="0"')
		expect(code).toContain('readExpr":"escapeHtml( count ) + \\"-\\" + escapeHtml( doubled )')
		expect(code).not.toContain('hypermediaRuntime:')
		expect(code).not.toContain('data-aero-on-click')
	})

	it('emits mountStateBindings for base on:* handlers in state scope', () => {
		const html = `<script is:state>
			let count = 1
			function inc() { count++ }
		</script>
		<button on:click="{ inc() }">{ count }</button>`

		const code = compile(parse(html), mockOptions)

		expect(code).toContain('data-aero-event="0"')
		expect(code).toContain('"handlerExpr":"inc()"')
		expect(code).toContain('"event":"click"')
		expect(code).not.toContain('hypermediaRuntime:')
		expect(code).not.toContain('data-aero-on-click')
	})

	it('does not emit mountStateBindings without is:state', () => {
		const html = `<button on:click="{ alert(1) }">{ 'x' }</button>`
		const code = compile(parse(html), mockOptions)

		expect(code).not.toContain('mountStateBindings')
		expect(code).not.toContain('data-aero-text=')
		expect(code).toContain('data-aero-on-click')
	})

	it('hydration payload includes owned bindings only', () => {
		const html = `<script is:state>
			let count = 1
			let doubled = count * 2
		</script>
		<div>{ count }</div>`

		const code = compile(parse(html), mockOptions)

		expect(code).toContain('escapeScriptJson({ "count": count })')
		expect(code).not.toContain('"doubled": doubled')
		expect(code).not.toContain('"doubled":2')
	})

	it('serializes live props declared from Aero.props in is:state', () => {
		const html = `<script is:state>
			const { count, label = 'Counter' } = Aero.props
		</script>
		<p>{ label }: { count }</p>`

		const code = compile(parse(html), mockOptions)

		expect(code).toContain('"name":"count"')
		expect(code).toContain('"liveProp":true')
		expect(code).toContain('"required":true')
		expect(code).toContain('"name":"label"')
		expect(code).toContain(`"initExpr":"'Counter'"`)
		expect(code).toContain('"required":false')
		expect(code).toContain('liveProps: opts.liveProps ?? {}')
		expect(code).not.toContain('"count": count')
		expect(code).not.toContain('"label": label')
	})

	it('exports live prop metadata for parent component wiring', () => {
		const html = `<script is:state>
			const { count, title: heading, label = 'Counter' } = Aero.props
		</script>
		<p>{ heading }: { label } { count }</p>`

		const code = compile(parse(html), mockOptions)

		expect(code).toContain('export const __aeroLiveProps =')
		expect(code).toContain('"name":"count"')
		expect(code).toContain('"propName":"count"')
		expect(code).toContain('"required":true')
		expect(code).toContain('"name":"heading"')
		expect(code).toContain('"propName":"title"')
		expect(code).toContain('"name":"label"')
		expect(code).toContain('"required":false')
	})

	it('emits component bind records for reactive parent component instances', () => {
		const html = `<script is:build>
			const counter = { name: 'counter' }
		</script>
		<script is:state>
			let count = 1
		</script>
		<counter-component count="{ count }" label="Static" />`

		const code = compile(parse(html), mockOptions)

		expect(code).toContain('data-aero-component="0"')
		expect(code).toContain('componentBinds:')
		expect(code).toContain('component: counter')
		expect(code).toContain('livePropExprs: {"count":"count"}')
	})

	it('emits component bind records for reactive parent components without live props', () => {
		const html = `<script is:build>
			const counter = { name: 'counter' }
		</script>
		<script is:state>
			let count = 1
		</script>
		<counter-component label="Static" />`

		const code = compile(parse(html), mockOptions)

		expect(code).toContain('data-aero-component="0"')
		expect(code).toContain('componentBinds:')
		expect(code).toContain('component: counter')
		expect(code).toContain('livePropExprs: {}')
	})

	it('emits component module refs for imported components with live props', () => {
		const html = `<script is:build>
			import header from '@components/header'
		</script>
		<script is:state>
			let count = 1
		</script>
		<header-component count="{ count }" />`

		const code = compile(parse(html), mockOptions)

		expect(code).toContain('const __aeroMod_header = await import')
		expect(code).toContain('const header = __aeroMod_header.default')
		expect(code).toContain('component: __aeroMod_header')
	})

	it('collects reactive binds inside switch branches with is:state', () => {
		const html = `<script is:state>
			const auth = { state: 'SignedOut' }
		</script>
		<div switch="{ auth.state }">
			<span case="SignedIn">{ auth.state }</span>
			<span default>Default</span>
		</div>`

		expect(() => compile(parse(html), mockOptions)).not.toThrow()
	})

	it('passes is:state imports into mount scopeConstants', () => {
		const html = `<script is:state>
			import { AuthState } from '@shared/types/auth'
			let authState = AuthState.SignedOut
			function toggleAuth() {
				authState = authState === AuthState.SignedIn ? AuthState.SignedOut : AuthState.SignedIn
			}
		</script>
		<a on:click="{ toggleAuth() }">{ authState === AuthState.SignedIn ? 'Log Out' : 'Log In' }</a>`

		const code = compile(parse(html), mockOptions)
		expect(code).toContain('scopeConstants: { AuthState: AuthState }')
	})

	it('includes hypermedia runtime wiring when hypermedia: true', () => {
		const html = `<script is:state>
			let count = 1
		</script>
		<div>{ count }</div>`

		const code = compile(parse(html), { ...mockOptions, hypermedia: true })
		expect(code).toContain('hypermediaRuntime: Aero.getHypermediaRuntime?.() ?? undefined')
		expect(code).not.toContain("import { POST, GET, PUT, PATCH, DELETE }")
	})
})
