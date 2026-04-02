/**
 * Build manifest: versioning, hashing, read/write, skip predicate.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
	AERO_BUILD_MANIFEST_VERSION,
	canSkipEntirePrerender,
	computeClientHtmlFingerprint,
	diffTemplateFileHashes,
	hashStaticBuildOptions,
	readBuildManifest,
	writeBuildManifest,
	type AeroBuildManifest,
} from '../build-manifest'

describe('build-manifest', () => {
	let tmp: string
	afterEach(() => {
		if (tmp && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true })
	})

	it('readBuildManifest returns null for missing file', () => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-bm-'))
		expect(readBuildManifest(tmp)).toBeNull()
	})

	it('round-trips write/read and rejects wrong version', () => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-bm-'))
		const m: AeroBuildManifest = {
			version: AERO_BUILD_MANIFEST_VERSION,
			generatedAt: '2026-01-01T00:00:00.000Z',
			viteManifestHash: 'abc',
			clientHtmlFingerprint: 'def',
			staticBuildOptionsHash: 'ghi',
			templateFileHashes: { 'client/pages/index.html': 'aa' },
			pages: { '': { outputFile: 'index.html' } },
		}
		writeBuildManifest(tmp, m)
		expect(readBuildManifest(tmp)).toEqual(m)

		const p = path.join(tmp, '.aero', 'cache', 'build-manifest.json')
		fs.writeFileSync(p, JSON.stringify({ ...m, version: 999 }), 'utf-8')
		expect(readBuildManifest(tmp)).toBeNull()
	})

	it('canSkipEntirePrerender requires previous manifest and current vite hash', () => {
		const prev: AeroBuildManifest = {
			version: AERO_BUILD_MANIFEST_VERSION,
			generatedAt: 'x',
			viteManifestHash: 'v1',
			clientHtmlFingerprint: 'c1',
			staticBuildOptionsHash: 'o1',
			pages: {},
		}
		expect(
			canSkipEntirePrerender({
				previous: null,
				currentViteManifestHash: 'v1',
				currentClientHtmlFingerprint: 'c1',
				currentStaticBuildOptionsHash: 'o1',
			})
		).toBe(false)
		expect(
			canSkipEntirePrerender({
				previous: prev,
				currentViteManifestHash: null,
				currentClientHtmlFingerprint: 'c1',
				currentStaticBuildOptionsHash: 'o1',
			})
		).toBe(false)
		expect(
			canSkipEntirePrerender({
				previous: prev,
				currentViteManifestHash: 'v1',
				currentClientHtmlFingerprint: 'c1',
				currentStaticBuildOptionsHash: 'o1',
			})
		).toBe(true)
		expect(
			canSkipEntirePrerender({
				previous: prev,
				currentViteManifestHash: 'v2',
				currentClientHtmlFingerprint: 'c1',
				currentStaticBuildOptionsHash: 'o1',
			})
		).toBe(false)
	})

	it('computeClientHtmlFingerprint changes when an html file changes', () => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-bm-'))
		const client = path.join(tmp, 'client')
		fs.mkdirSync(path.join(client, 'pages'), { recursive: true })
		const f = path.join(client, 'pages', 'a.html')
		fs.writeFileSync(f, '<html></html>', 'utf-8')
		const fp1 = computeClientHtmlFingerprint(tmp, 'client')
		fs.writeFileSync(f, '<html><body>x</body></html>', 'utf-8')
		const fp2 = computeClientHtmlFingerprint(tmp, 'client')
		expect(fp1).not.toBe(fp2)
	})

	it('hashStaticBuildOptions distinguishes site and redirects', () => {
		expect(hashStaticBuildOptions('https://a.com', '[]')).not.toBe(
			hashStaticBuildOptions('https://b.com', '[]')
		)
		expect(hashStaticBuildOptions('', '[]')).not.toBe(hashStaticBuildOptions('', '[{"from":"/x"}]'))
	})

	it('diffTemplateFileHashes reports added, removed, and changed paths', () => {
		const prev = { 'client/a.html': 'h1', 'client/b.html': 'h2' }
		const curr = { 'client/a.html': 'h1x', 'client/c.html': 'h3' }
		const d = diffTemplateFileHashes(prev, curr)
		expect(d.sort()).toEqual(['client/a.html', 'client/b.html', 'client/c.html'].sort())
	})

	it('readBuildManifest accepts version 1 manifests without templateFileHashes', () => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-bm-'))
		const m = {
			version: 1,
			generatedAt: '2026-01-01T00:00:00.000Z',
			viteManifestHash: 'v',
			clientHtmlFingerprint: 'c',
			staticBuildOptionsHash: 's',
			pages: {},
		}
		writeBuildManifest(tmp, m as unknown as AeroBuildManifest)
		const read = readBuildManifest(tmp)
		expect(read?.version).toBe(1)
		expect(read?.templateFileHashes).toBeUndefined()
	})
})
