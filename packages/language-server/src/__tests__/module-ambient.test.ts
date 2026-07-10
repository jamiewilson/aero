import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AMBIENT_DECLARATIONS } from '@aero-js/compiler/ambient-preamble'
import { AeroVirtualCode } from '../virtualCode'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function createSnapshot(text: string) {
	return {
		getText: (start: number, end: number) => text.substring(start, end),
		getLength: () => text.length,
		getChangeRange: () => undefined,
	}
}

function getEmbeddedText(code: AeroVirtualCode, id: string): string | undefined {
	const embedded = code.embeddedCodes?.find(c => c.id === id)
	return embedded?.snapshot.getText(0, embedded.snapshot.getLength())
}

function semanticDiagnosticCodes(
	script: string,
	fullAmbient: string,
	extraRootFiles: string[] = []
): number[] {
	const opts: ts.CompilerOptions = {
		target: ts.ScriptTarget.ESNext,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		strict: true,
		skipLibCheck: true,
		noEmit: true,
	}
	const virtualFile = '/probe/virtual.build_0.ts'
	const ambientFile = '/probe/ambient.d.ts'
	const host = ts.createCompilerHost(opts, true)
	const orig = host.getSourceFile.bind(host)
	host.getSourceFile = (fileName, languageVersion, ...rest) => {
		if (fileName === virtualFile) {
			return ts.createSourceFile(
				fileName,
				script + '\nexport {}\n',
				languageVersion,
				true,
				ts.ScriptKind.TS
			)
		}
		if (fileName === ambientFile) {
			return ts.createSourceFile(
				fileName,
				fullAmbient,
				languageVersion,
				true,
				ts.ScriptKind.TS
			)
		}
		return orig(fileName, languageVersion, ...rest)
	}
	const program = ts.createProgram([virtualFile, ambientFile, ...extraRootFiles], opts, host)
	const sf = program.getSourceFile(virtualFile)
	if (!sf) return []
	return program.getSemanticDiagnostics(sf).map(d => d.code)
}

function diagnostics2307(script: string, fullAmbient: string): string[] {
	const opts: ts.CompilerOptions = {
		target: ts.ScriptTarget.ESNext,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		strict: true,
		skipLibCheck: true,
		noEmit: true,
	}
	const virtualFile = '/probe/virtual.build_0.ts'
	const ambientFile = '/probe/ambient.d.ts'
	const host = ts.createCompilerHost(opts, true)
	const orig = host.getSourceFile.bind(host)
	host.getSourceFile = (fileName, languageVersion, ...rest) => {
		if (fileName === virtualFile) {
			return ts.createSourceFile(
				fileName,
				script + '\nexport {}\n',
				languageVersion,
				true,
				ts.ScriptKind.TS
			)
		}
		if (fileName === ambientFile) {
			return ts.createSourceFile(
				fileName,
				fullAmbient,
				languageVersion,
				true,
				ts.ScriptKind.TS
			)
		}
		return orig(fileName, languageVersion, ...rest)
	}
	const program = ts.createProgram([virtualFile, ambientFile], opts, host)
	const sf = program.getSourceFile(virtualFile)
	if (!sf) return []
	return program
		.getSemanticDiagnostics(sf)
		.filter(d => d.code === 2307)
		.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' '))
}

describe('module ambient declarations', () => {
	it('declares only resolved template modules and reports missing local templates', () => {
		const kitchenSink = path.resolve(__dirname, '../../../../examples/kitchen-sink')
		const pagePath = path.join(kitchenSink, 'client/pages/demos/testing.html')
		const code = new AeroVirtualCode(
			createSnapshot(`<script is:build>import code from '@client/components/code.html'</script>`),
			pagePath
		)
		const ambient = getEmbeddedText(code, 'ambient')!
		expect(ambient).toContain("declare module '@client/components/code.html'")
		expect(diagnostics2307(`import code from '@client/components/code.html'`, ambient)).toEqual([])
		expect(diagnostics2307(`import missing from './missing.html'`, ambient)).toHaveLength(1)
	})

	it('includes image wildcard modules in shared ambient', () => {
		expect(AMBIENT_DECLARATIONS).toContain("declare module '*.jpg'")
		expect(AMBIENT_DECLARATIONS).not.toContain("declare module '*.ts'")
	})

	it('does not TS2307 for @images/about.jpg with shared ambient only', () => {
		const script = `import aboutImage from '@images/about.jpg'`
		expect(diagnostics2307(script, AMBIENT_DECLARATIONS)).toEqual([])
	})

	it('adds per-file ambient for resolved @content/site.ts imports', () => {
		const kitchenSink = path.resolve(__dirname, '../../../../examples/kitchen-sink')
		const pagePath = path.join(kitchenSink, 'client/pages/demos/testing.html')
		const html = `<script is:build>
import site from '@content/site.ts'
const title = site.home.title
</script>`

		const code = new AeroVirtualCode(createSnapshot(html), pagePath)
		const ambient = getEmbeddedText(code, 'ambient')!
		expect(ambient).toContain("declare module '@content/site.ts'")
		expect(ambient).toContain("export { default } from '")
		expect(diagnostics2307(`import site from '@content/site.ts'`, ambient)).toEqual([])

		const script = `import site from '@content/site.ts'\nconst title = site.home.title`
		const opts: ts.CompilerOptions = {
			target: ts.ScriptTarget.ESNext,
			module: ts.ModuleKind.ESNext,
			moduleResolution: ts.ModuleResolutionKind.Bundler,
			strict: true,
			skipLibCheck: true,
			noEmit: true,
		}
		const virtualFile = '/probe/virtual.build_0.ts'
		const ambientFile = '/probe/ambient.d.ts'
		const host = ts.createCompilerHost(opts, true)
		const orig = host.getSourceFile.bind(host)
		host.getSourceFile = (fileName, languageVersion, ...rest) => {
			if (fileName === virtualFile) {
				return ts.createSourceFile(
					fileName,
					script + '\nexport {}\n',
					languageVersion,
					true,
					ts.ScriptKind.TS
				)
			}
			if (fileName === ambientFile) {
				return ts.createSourceFile(fileName, ambient, languageVersion, true, ts.ScriptKind.TS)
			}
			return orig(fileName, languageVersion, ...rest)
		}
		const sitePath = path.join(kitchenSink, 'content/site.ts')
		const program = ts.createProgram([virtualFile, ambientFile, sitePath], opts, host)
		const sf = program.getSourceFile(virtualFile)!
		const errors18046 = program
			.getSemanticDiagnostics(sf)
			.filter(d => d.code === 18046)
			.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' '))
		expect(errors18046).toEqual([])
	})

	it('re-exports named types from resolved @client/types/props.ts', () => {
		const kitchenSink = path.resolve(__dirname, '../../../../examples/kitchen-sink')
		const pagePath = path.join(kitchenSink, 'client/components/header.html')
		const html = `<script is:build>
import type { HeaderProps } from '@client/types/props.ts'
const props = Aero.props as HeaderProps
</script>`

		const code = new AeroVirtualCode(createSnapshot(html), pagePath)
		const ambient = getEmbeddedText(code, 'ambient')!
		expect(ambient).toContain("declare module '@client/types/props.ts'")
		expect(ambient).toContain("export type { MetaProps, HeaderProps, GreetingProps, CardProps } from '../types/props'")
		expect(ambient).not.toContain("export * from '../types/props.ts'")
		expect(ambient).not.toMatch(/@client\/types\/props\.ts'[\s\S]*export \{ default \}/)

		const script = `import type { HeaderProps } from '@client/types/props.ts'\nconst p: HeaderProps = { title: 'x', requiredProp: true }`
		const propsPath = path.join(kitchenSink, 'client/types/props.ts')
		expect(diagnostics2307(script, ambient)).toEqual([])
		expect(semanticDiagnosticCodes(script, ambient, [propsPath])).not.toContain(2305)
	})
})
