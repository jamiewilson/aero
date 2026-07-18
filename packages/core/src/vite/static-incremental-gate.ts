/**
 * Incremental static prerender: whole-build skip and dirty-page filtering.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { RedirectRule } from '../types'
import {
	AERO_BUILD_MANIFEST_VERSION,
	canSkipEntirePrerender,
	computeClientHtmlFingerprint,
	diffTemplateFileHashes,
	hashStaticBuildOptions,
	hashViteOutputManifest,
	isIncrementalStaticBuildEnabled,
	readBuildManifest,
	writeBuildManifest,
	type AeroBuildManifest,
} from './build-manifest'
import { aeroStaticBuildDebug } from './static-prerender-pool'
import { trimEdgeSlashes, isDynamicPage, type StaticPage } from './static-page-discovery'
import {
	collectTransitiveTemplateImports,
	computeTemplateFileHashesMap,
	getResolvePathForProject,
} from './template-import-closure'

/** Filter out pages whose route matches a redirect `from` (Nitro handles those). */
export function filterPagesAgainstRedirects(
	pages: readonly StaticPage[],
	redirects: RedirectRule[] | undefined
): StaticPage[] {
	if (!redirects?.length) return [...pages]
	const redirectFromSet = new Set(redirects.map(r => trimEdgeSlashes(r.from).trim() || ''))
	return pages.filter(page => {
		const pathSegment = page.routePath === '' ? '' : page.routePath
		return !redirectFromSet.has(pathSegment)
	})
}

export interface IncrementalGateInput {
	root: string
	clientDir: string
	distDir: string
	site: string
	redirectsJson: string
	discoveredPages: readonly StaticPage[]
	resolvePath?: (specifier: string, importer: string) => string
}

export interface IncrementalGateContext {
	prevBuildManifest: AeroBuildManifest | null
	viteManifestHashForIncremental: string | null
	clientHtmlFingerprint: string
	staticBuildOptionsHash: string
	templateFileHashesCurrent: Record<string, string>
	hasDynamicRoutes: boolean
	/** True when the entire prerender phase can be skipped. */
	skipEntirePrerender: boolean
}

/** Compute incremental hashes and whether the whole prerender phase can be skipped. */
export function evaluateIncrementalGate(input: IncrementalGateInput): IncrementalGateContext {
	const {
		root,
		clientDir,
		distDir,
		site,
		redirectsJson,
		discoveredPages,
	} = input

	const prevBuildManifest = readBuildManifest(root)
	const viteManifestHashForIncremental = hashViteOutputManifest(distDir)
	const clientHtmlFingerprint = computeClientHtmlFingerprint(root, clientDir)
	const staticBuildOptionsHash = hashStaticBuildOptions(site, redirectsJson)
	const templateFileHashesCurrent = computeTemplateFileHashesMap(root, clientDir)
	const hasDynamicRoutes = discoveredPages.some(p => isDynamicPage(p))

	if (isIncrementalStaticBuildEnabled() && hasDynamicRoutes) {
		aeroStaticBuildDebug(
			'static prerender: incremental whole-phase skip disabled (dynamic [param] page(s) present; getStaticPaths must run each build)'
		)
	}

	const skipEntirePrerender =
		isIncrementalStaticBuildEnabled() &&
		!hasDynamicRoutes &&
		canSkipEntirePrerender({
			previous: prevBuildManifest,
			currentViteManifestHash: viteManifestHashForIncremental,
			currentClientHtmlFingerprint: clientHtmlFingerprint,
			currentStaticBuildOptionsHash: staticBuildOptionsHash,
		})

	return {
		prevBuildManifest,
		viteManifestHashForIncremental,
		clientHtmlFingerprint,
		staticBuildOptionsHash,
		templateFileHashesCurrent,
		hasDynamicRoutes,
		skipEntirePrerender,
	}
}

/** Select which pages to prerender under incremental partial rebuild. */
export function selectPagesToPrerender(
	pagesToRender: readonly StaticPage[],
	gate: IncrementalGateContext,
	root: string,
	clientDir: string,
	resolvePath?: (specifier: string, importer: string) => string
): StaticPage[] {
	if (
		!isIncrementalStaticBuildEnabled() ||
		gate.hasDynamicRoutes ||
		!gate.prevBuildManifest ||
		!gate.prevBuildManifest.templateFileHashes ||
		gate.prevBuildManifest.viteManifestHash !== gate.viteManifestHashForIncremental ||
		gate.prevBuildManifest.staticBuildOptionsHash !== gate.staticBuildOptionsHash
	) {
		return [...pagesToRender]
	}

	const changed = diffTemplateFileHashes(
		gate.prevBuildManifest.templateFileHashes,
		gate.templateFileHashesCurrent
	)
	if (changed.length === 0) return [...pagesToRender]

	const resolve = getResolvePathForProject(root, resolvePath)
	const dirty: StaticPage[] = []
	for (const page of pagesToRender) {
		const closure = collectTransitiveTemplateImports(
			root,
			clientDir,
			resolve,
			page.sourceFile
		)
		let needs = false
		for (const c of changed) {
			if (closure.has(c)) {
				needs = true
				break
			}
		}
		if (needs) dirty.push(page)
	}

	if (dirty.length === 0) {
		aeroStaticBuildDebug(
			'static prerender: incremental partial — no page depends on changed template(s); skipping HTML writes'
		)
		return []
	}
	if (dirty.length < pagesToRender.length) {
		aeroStaticBuildDebug(
			`static prerender: incremental partial (${dirty.length} of ${pagesToRender.length} page(s))`
		)
		return dirty
	}
	return [...pagesToRender]
}

/** Write incremental build manifest and unlink stale HTML outputs. */
export function finalizeIncrementalManifest(
	root: string,
	clientDir: string,
	distDir: string,
	pagesToRender: readonly StaticPage[],
	gate: IncrementalGateContext
): void {
	if (!isIncrementalStaticBuildEnabled()) return

	const produced = new Set(pagesToRender.map(p => p.outputFile))
	if (gate.prevBuildManifest) {
		for (const entry of Object.values(gate.prevBuildManifest.pages)) {
			if (!produced.has(entry.outputFile)) {
				const stale = path.join(distDir, entry.outputFile)
				if (fs.existsSync(stale)) fs.unlinkSync(stale)
			}
		}
	}
	writeBuildManifest(root, {
		version: AERO_BUILD_MANIFEST_VERSION,
		generatedAt: new Date().toISOString(),
		viteManifestHash: hashViteOutputManifest(distDir) ?? '',
		clientHtmlFingerprint: computeClientHtmlFingerprint(root, clientDir),
		staticBuildOptionsHash: gate.staticBuildOptionsHash,
		templateFileHashes: gate.templateFileHashesCurrent,
		pages: Object.fromEntries(
			pagesToRender.map(p => [p.routePath, { outputFile: p.outputFile }])
		),
	})
}
