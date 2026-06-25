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
	collectBindingsFromBuildScriptContent,
} from './build-scope-bindings'
import { analyzeStateScript } from './state-script-analysis'

/**
 * Ambient prelude inputs for template interpolations — same shape used by {@link formatBuildScopeAmbientPrelude}.
 */
export type TemplateEditorAmbient = {
	/**
	 * Bodies of `<script is:build>` in document order, merged exactly as {@link parse} does
	 * (one entry when any build script exists: joined with `\n`).
	 */
	readonly buildScriptBodies: readonly string[]
	/** Body of `<script is:state>` when present. */
	readonly stateScriptBodies: readonly string[]
	/** `interface` / `type` / `enum` slices extracted for template expression checking. */
	readonly typeDeclarationTexts: readonly string[]
	/** Value-like binding names visible in `{ }` interpolations. */
	readonly bindingNames: ReadonlySet<string>
	/** Non-derived `is:state` bindings that are writable in event handlers. */
	readonly writableStateBindingNames: ReadonlySet<string>
	/** Live props that are intentionally readonly but may need Aero-specific write diagnostics. */
	readonly readonlyLivePropNames: ReadonlySet<string>
}

/** Build + state script bodies used for template expression type inference. */
export function getBindingInferenceScriptBodies(
	ambient: Pick<TemplateEditorAmbient, 'buildScriptBodies' | 'stateScriptBodies'>
): readonly string[] {
	return [...ambient.buildScriptBodies, ...ambient.stateScriptBodies]
}

/**
 * Build editor ambient data from an already-parsed template (no re-parse).
 */
export function getTemplateEditorAmbientFromParsed(parsed: ParseResult): TemplateEditorAmbient {
	const buildScriptBodies: string[] =
		parsed.buildScript && parsed.buildScript.content.trim().length > 0
			? [parsed.buildScript.content]
			: []
	const stateScriptBodies: string[] =
		parsed.stateScript && parsed.stateScript.content.trim().length > 0
			? [parsed.stateScript.content]
			: []
	const bindingNames = collectBuildScopeBindingNames(buildScriptBodies)
	const writableStateBindingNames = new Set<string>()
	const readonlyLivePropNames = new Set<string>()
	for (const stateBody of stateScriptBodies) {
		collectBindingsFromBuildScriptContent(stateBody, bindingNames)
		try {
			const analysis = analyzeStateScript(stateBody)
			for (const b of analysis.bindings) {
				bindingNames.add(b.name)
				if (!b.derived && (!b.liveProp || b.bindable)) writableStateBindingNames.add(b.name)
				if (b.liveProp && !b.bindable) readonlyLivePropNames.add(b.name)
			}
		} catch {
			// Keep editor ambient resilient to partial/in-progress state scripts.
		}
	}
	const typeDeclarationTexts = collectBuildScriptTypeDeclarationTexts(buildScriptBodies)
	return {
		buildScriptBodies,
		stateScriptBodies,
		typeDeclarationTexts,
		bindingNames,
		writableStateBindingNames,
		readonlyLivePropNames,
	}
}

/**
 * Parse `html` with the compiler and return editor ambient fields shared with {@link buildTemplateAnalysis}.
 */
export function buildTemplateEditorAmbient(html: string): TemplateEditorAmbient {
	return getTemplateEditorAmbientFromParsed(parse(html))
}
