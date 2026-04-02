/**
 * Build-scope metadata for editor tooling, derived from the same {@link parse} path as codegen.
 *
 * @remarks
 * Keeps the language server and compiler aligned on merged build scripts, binding names, and type slices.
 */

import type { ParseResult } from './types'
import { parse } from './parser'
import {
	collectBuildScopeBindingNames,
	collectBuildScriptTypeDeclarationTexts,
} from './build-scope-bindings'

/**
 * Ambient prelude inputs for template interpolations — same shape used by {@link formatBuildScopeAmbientPrelude}.
 */
export type TemplateEditorAmbient = {
	/**
	 * Bodies of `<script is:build>` in document order, merged exactly as {@link parse} does
	 * (one entry when any build script exists: joined with `\n`).
	 */
	readonly buildScriptBodies: readonly string[]
	/** `interface` / `type` / `enum` slices extracted for template expression checking. */
	readonly typeDeclarationTexts: readonly string[]
	/** Value-like binding names visible in `{ }` interpolations. */
	readonly bindingNames: ReadonlySet<string>
}

/**
 * Build editor ambient data from an already-parsed template (no re-parse).
 */
export function getTemplateEditorAmbientFromParsed(parsed: ParseResult): TemplateEditorAmbient {
	const buildScriptBodies: string[] =
		parsed.buildScript && parsed.buildScript.content.trim().length > 0
			? [parsed.buildScript.content]
			: []
	const bindingNames = collectBuildScopeBindingNames(buildScriptBodies)
	const typeDeclarationTexts = collectBuildScriptTypeDeclarationTexts(buildScriptBodies)
	return { buildScriptBodies, typeDeclarationTexts, bindingNames }
}

/**
 * Parse `html` with the compiler and return editor ambient fields shared with {@link buildTemplateAnalysis}.
 */
export function buildTemplateEditorAmbient(html: string): TemplateEditorAmbient {
	return getTemplateEditorAmbientFromParsed(parse(html))
}
