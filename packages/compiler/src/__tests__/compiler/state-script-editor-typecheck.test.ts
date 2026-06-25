import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { annotateStateScriptForEditorTypecheck } from '../../state-script-editor-typecheck'

const AUTH_STATE_STUB = `
export const AuthState = {
	SignedIn: 'SignedIn',
	SignedOut: 'SignedOut',
} as const
export type AuthState = (typeof AuthState)[keyof typeof AuthState]
`

describe('annotateStateScriptForEditorTypecheck', () => {
	it('widens top-level let bindings for editor virtual TS', () => {
		const script = `import { AuthState } from '@shared/types/auth'
let authState = AuthState.SignedOut
let authHref = authState === AuthState.SignedIn ? '/logout' : '/login'
function toggleAuth() {
	authState = authState === AuthState.SignedIn ? AuthState.SignedOut : AuthState.SignedIn
}`

		const mapped = annotateStateScriptForEditorTypecheck(script)
		expect(mapped.text).toContain(
			'let authState: AuthState = AuthState.SignedOut as AuthState'
		)
		expect(mapped.text).toContain(
			"let authHref: string = authState === AuthState.SignedIn ? '/logout' : '/login'"
		)
		expect(mapped.segments.length).toBeGreaterThan(1)
	})

	it('avoids TS2367 on derived href/label lines after authState widening', () => {
		const script = `${AUTH_STATE_STUB}
let authState = AuthState.SignedOut
let authHref = authState === AuthState.SignedIn ? '/logout' : '/login'
let authLabel = authState === AuthState.SignedIn ? 'Log Out' : 'Log In'
function toggleAuth() {
	authState = authState === AuthState.SignedIn ? AuthState.SignedOut : AuthState.SignedIn
}`
		const mapped = annotateStateScriptForEditorTypecheck(script)
		const source = ts.createSourceFile(
			'state.ts',
			mapped.text,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS
		)
		const opts: ts.CompilerOptions = {
			target: ts.ScriptTarget.ESNext,
			module: ts.ModuleKind.ESNext,
			strict: true,
			skipLibCheck: true,
			noEmit: true,
		}
		const host = ts.createCompilerHost(opts)
		const program = ts.createProgram(['state.ts'], opts, {
			...host,
			getSourceFile: (fileName, languageVersion, ...rest) => {
				if (fileName.endsWith('state.ts')) return source
				return host.getSourceFile(fileName, languageVersion, ...rest)
			},
		})
		const diags = program.getSemanticDiagnostics(source).filter(d => {
			const code = Number(d.code)
			return code === 2367 || code === 2322
		})
		expect(diags).toEqual([])
	})

	it('allows toggle assignment after annotation in isolated TS check', () => {
		const script = `${AUTH_STATE_STUB}
let authState = AuthState.SignedOut
function toggleAuth() {
	authState = authState === AuthState.SignedIn ? AuthState.SignedOut : AuthState.SignedIn
}`
		const mapped = annotateStateScriptForEditorTypecheck(script)
		const source = ts.createSourceFile(
			'state.ts',
			mapped.text,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS
		)
		const opts: ts.CompilerOptions = {
			target: ts.ScriptTarget.ESNext,
			module: ts.ModuleKind.ESNext,
			strict: true,
			skipLibCheck: true,
			noEmit: true,
		}
		const host = ts.createCompilerHost(opts)
		const program = ts.createProgram(['state.ts'], opts, {
			...host,
			getSourceFile: (fileName, languageVersion, ...rest) => {
				if (fileName.endsWith('state.ts')) return source
				return host.getSourceFile(fileName, languageVersion, ...rest)
			},
		})
		const diags = program.getSemanticDiagnostics(source).filter(d => {
			const code = Number(d.code)
			return code === 2367 || code === 2322
		})
		expect(diags).toEqual([])
	})
})
