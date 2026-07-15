import { describe, expect, it } from 'vitest'
import {
	HYPERMEDIA_BUILD_IMPORT_MESSAGE,
	HYPERMEDIA_STATE_IMPORT_MESSAGE,
	collectHypermediaActionImportsInBuildScript,
	collectMissingHypermediaActionImportsInStateScript,
	isHypermediaActionImport,
} from '../../hypermedia-build-imports'

describe('hypermedia build imports', () => {
	it('detects named action imports from @aero-js/hypermedia', () => {
		expect(isHypermediaActionImport('@aero-js/hypermedia', 'GET')).toBe(true)
		expect(isHypermediaActionImport('@aero-js/hypermedia', 'createHypermediaRuntime')).toBe(false)
		expect(isHypermediaActionImport('./local', 'GET')).toBe(false)

		const hits = collectHypermediaActionImportsInBuildScript(
			`import { GET, POST as post, createHypermediaRuntime } from '@aero-js/hypermedia'`
		)
		expect(hits.map(h => h.imported).sort()).toEqual(['GET', 'POST'])
		expect(hits.find(h => h.imported === 'POST')?.local).toBe('post')
	})

	it('returns empty when no banned imports', () => {
		expect(
			collectHypermediaActionImportsInBuildScript(
				`import { createHypermediaRuntime } from '@aero-js/hypermedia'`
			)
		).toEqual([])
	})

	it('detects missing action imports in state script', () => {
		const hits = collectMissingHypermediaActionImportsInStateScript(
			`const load = () => GET('/api/x')`
		)
		expect(hits.map(h => h.name)).toEqual(['GET'])
		expect(
			collectMissingHypermediaActionImportsInStateScript(
				`import { GET } from '@aero-js/hypermedia'\nconst load = () => GET('/api/x')`
			)
		).toEqual([])
	})
})

describe('feature gates hypermedia build imports', () => {
	it('errors when importing GET in is:build', async () => {
		const { compile } = await import('../../codegen')
		const { parse } = await import('../../parser')
		const html = `<script is:build>
	import { GET } from '@aero-js/hypermedia'
</script>
<button on:click="{ GET('/api/x') }">Go</button>`
		expect(() =>
			compile(parse(html), {
				root: '/',
				resolvePath: (v: string) => v,
				importer: '/test.html',
				hypermedia: true,
			})
		).toThrow(HYPERMEDIA_BUILD_IMPORT_MESSAGE)
	})

	it('errors when GET is used in is:state without import', async () => {
		const { compile } = await import('../../codegen')
		const { parse } = await import('../../parser')
		const html = `<script is:state>
	const load = () => GET('/api/x')
</script>
<button on:click="{ load() }">Go</button>`
		expect(() =>
			compile(parse(html), {
				root: '/',
				resolvePath: (v: string) => v,
				importer: '/test.html',
				reactivity: true,
				hypermedia: true,
			})
		).toThrow(HYPERMEDIA_STATE_IMPORT_MESSAGE)
	})

	it('allows GET import in is:state', async () => {
		const { compile } = await import('../../codegen')
		const { parse } = await import('../../parser')
		const html = `<script is:state>
	import { GET } from '@aero-js/hypermedia'
	const load = () => GET('/api/x')
</script>
<button on:click="{ load() }">Go</button>`
		expect(() =>
			compile(parse(html), {
				root: '/',
				resolvePath: (v: string) => v,
				importer: '/test.html',
				reactivity: true,
				hypermedia: true,
			})
		).not.toThrow()
	})

	it('allows intrinsic GET in on:* without state import', async () => {
		const { compile } = await import('../../codegen')
		const { parse } = await import('../../parser')
		const html = `<script is:state>
	let label = 'Go'
</script>
<button on:click="{ GET('/api/x') }">{ label }</button>`
		expect(() =>
			compile(parse(html), {
				root: '/',
				resolvePath: (v: string) => v,
				importer: '/test.html',
				reactivity: true,
				hypermedia: true,
			})
		).not.toThrow()
	})
})
