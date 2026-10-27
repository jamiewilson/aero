import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, afterEach } from 'vite-plus/test'
import { clearResolverCache, collectTemplateDiagnostics } from '../index'
import type { SourceDocument } from '../source-document'

function makeDocument(text: string, fsPath: string): SourceDocument {
	return {
		uri: { fsPath },
		getText: () => text,
		positionAt: (offset: number) => {
			const lines = text.slice(0, offset).split('\n')
			return {
				line: lines.length - 1,
				character: lines[lines.length - 1]?.length ?? 0,
			}
		},
		offsetAt: (position: { line: number; character: number }) => {
			const lines = text.split('\n')
			let offset = 0
			for (let i = 0; i < position.line; i++) {
				offset += (lines[i]?.length ?? 0) + 1
			}
			return offset + position.character
		},
	}
}

function scaffoldAeroProject(root: string): {
	pagePath: string
	componentsDir: string
	layoutsDir: string
} {
	const client = path.join(root, 'client')
	const componentsDir = path.join(client, 'components')
	const layoutsDir = path.join(client, 'layouts')
	const pagesDir = path.join(client, 'pages')
	fs.mkdirSync(componentsDir, { recursive: true })
	fs.mkdirSync(layoutsDir, { recursive: true })
	fs.mkdirSync(pagesDir, { recursive: true })
	fs.writeFileSync(path.join(layoutsDir, 'base.html'), '<slot />', 'utf-8')
	fs.writeFileSync(path.join(componentsDir, 'footer.html'), '<footer />', 'utf-8')
	const pagePath = path.join(pagesDir, 'home.html')
	return { pagePath, componentsDir, layoutsDir }
}

const tempRoots: string[] = []

afterEach(() => {
	clearResolverCache()
	for (const root of tempRoots.splice(0)) {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

describe('component auto-import diagnostics', () => {
	it('does not report Component is not defined for auto-imported tags', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-auto-import-undef-'))
		tempRoots.push(root)
		const { pagePath } = scaffoldAeroProject(root)
		const text = `<script is:build>
import site from '@content/site.ts'
</script>
<base-layout>
	<footer-component />
</base-layout>`
		fs.writeFileSync(pagePath, text, 'utf-8')

		const diagnostics = collectTemplateDiagnostics({
			document: makeDocument(text, pagePath),
			root,
			workspaceRoot: root,
			templateAutoImport: true,
		})

		expect(diagnostics.some(d => d.message.includes("Component 'base' is not defined"))).toBe(false)
		expect(diagnostics.some(d => d.message.includes("Component 'footer' is not defined"))).toBe(
			false
		)
	})

	it('does not require explicit imports when templateAutoImport is enabled', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-auto-import-'))
		tempRoots.push(root)
		const { pagePath } = scaffoldAeroProject(root)
		const text = `<base-layout>
	<footer-component />
</base-layout>`
		fs.writeFileSync(pagePath, text, 'utf-8')

		const diagnostics = collectTemplateDiagnostics({
			document: makeDocument(text, pagePath),
			root,
			workspaceRoot: root,
			templateAutoImport: true,
		})

		expect(diagnostics.some(d => d.message.includes('is not imported'))).toBe(false)
	})

	it('reports missing templates from the tag index', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-auto-import-missing-'))
		tempRoots.push(root)
		const { pagePath } = scaffoldAeroProject(root)
		const text = `<ghost-component />`
		fs.writeFileSync(pagePath, text, 'utf-8')

		const diagnostics = collectTemplateDiagnostics({
			document: makeDocument(text, pagePath),
			root,
			workspaceRoot: root,
			templateAutoImport: true,
		})

		const missing = diagnostics.find(
			d => d.code === 'AERO_RESOLVE' && d.message.includes("Component 'ghost' was not found")
		)
		expect(missing).toBeDefined()
	})

	it('reports ambiguous nested component basenames', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-auto-import-ambig-'))
		tempRoots.push(root)
		const { pagePath, componentsDir } = scaffoldAeroProject(root)
		fs.mkdirSync(path.join(componentsDir, 'theme'), { recursive: true })
		fs.writeFileSync(path.join(componentsDir, 'toggle.html'), '<a />', 'utf-8')
		fs.writeFileSync(path.join(componentsDir, 'theme', 'toggle.html'), '<b />', 'utf-8')
		const text = `<toggle-component />`
		fs.writeFileSync(pagePath, text, 'utf-8')

		const diagnostics = collectTemplateDiagnostics({
			document: makeDocument(text, pagePath),
			root,
			workspaceRoot: root,
			templateAutoImport: true,
		})

		const ambiguous = diagnostics.find(
			d => d.code === 'AERO_RESOLVE' && d.message.includes('ambiguous')
		)
		expect(ambiguous).toBeDefined()
	})

	it('requires explicit imports when templateAutoImport is false', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-auto-import-off-'))
		tempRoots.push(root)
		const { pagePath } = scaffoldAeroProject(root)
		const text = `<footer-component />`
		fs.writeFileSync(pagePath, text, 'utf-8')

		const diagnostics = collectTemplateDiagnostics({
			document: makeDocument(text, pagePath),
			root,
			workspaceRoot: root,
			templateAutoImport: false,
		})

		expect(diagnostics.some(d => d.message.includes("Component 'footer' is not imported"))).toBe(
			true
		)
	})

	it('validates explicit import specifiers before auto-import', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-auto-import-explicit-'))
		tempRoots.push(root)
		const { pagePath, componentsDir } = scaffoldAeroProject(root)
		fs.writeFileSync(path.join(componentsDir, 'footer.html'), '<footer />', 'utf-8')
		const text = `<script is:build>
import footer from '@components/missing-footer.html'
</script>
<footer-component />`
		fs.writeFileSync(pagePath, text, 'utf-8')

		const diagnostics = collectTemplateDiagnostics({
			document: makeDocument(text, pagePath),
			root,
			workspaceRoot: root,
			templateAutoImport: true,
		})

		expect(
			diagnostics.some(
				d => d.code === 'AERO_RESOLVE' && d.message.includes('Component file not found')
			)
		).toBe(true)
		expect(diagnostics.some(d => d.message.includes('ambiguous'))).toBe(false)
	})

	it('treats auto-resolved component tags as using the import binding', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-auto-import-unused-'))
		tempRoots.push(root)
		const { pagePath } = scaffoldAeroProject(root)
		const text = `<script is:build>
import footer from '@components/footer.html'
</script>
<footer-component />`
		fs.writeFileSync(pagePath, text, 'utf-8')

		const diagnostics = collectTemplateDiagnostics({
			document: makeDocument(text, pagePath),
			root,
			workspaceRoot: root,
			templateAutoImport: true,
		})

		expect(
			diagnostics.some(d => d.message.includes("'footer' is declared but its value is never read"))
		).toBe(false)
	})
})
