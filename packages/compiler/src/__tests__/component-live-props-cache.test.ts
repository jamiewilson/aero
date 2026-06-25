import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ComponentLivePropMetadataCache } from '../component-live-props-cache'

describe('ComponentLivePropMetadataCache', () => {
	let tmpDir: string

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-live-props-cache-'))
	})

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true })
	})

	it('reuses cached metadata when mtime is unchanged', () => {
		const componentsDir = path.join(tmpDir, 'components')
		fs.mkdirSync(componentsDir, { recursive: true })
		const filePath = path.join(componentsDir, 'counter.html')
		fs.writeFileSync(
			filePath,
			`<script is:state>
const { initial } = Aero.props
let count = initial
</script>
<div>{ count }</div>`,
			'utf-8'
		)

		const cache = new ComponentLivePropMetadataCache()
		const readSpy = vi.spyOn(fs, 'readFileSync')

		const first = cache.collect([componentsDir])
		const firstReads = readSpy.mock.calls.length

		const second = cache.collect([componentsDir])
		const secondReads = readSpy.mock.calls.length - firstReads

		expect(first.counter).toBeDefined()
		expect(second).toEqual(first)
		expect(secondReads).toBe(0)

		readSpy.mockRestore()
	})

	it('invalidates a file entry after content changes', () => {
		const componentsDir = path.join(tmpDir, 'components')
		fs.mkdirSync(componentsDir, { recursive: true })
		const filePath = path.join(componentsDir, 'counter.html')
		fs.writeFileSync(
			filePath,
			`<script is:state>
const { initial } = Aero.props
let count = initial
</script>`,
			'utf-8'
		)

		const cache = new ComponentLivePropMetadataCache()
		const first = cache.collect([componentsDir])

		fs.writeFileSync(
			filePath,
			`<script is:state>
const { initial, label } = Aero.props
let count = initial
</script>`,
			'utf-8'
		)
		cache.invalidate(filePath)

		const second = cache.collect([componentsDir])
		expect((first.counter?.length ?? 0)).toBe(1)
		expect((second.counter?.length ?? 0)).toBe(2)
	})
})
