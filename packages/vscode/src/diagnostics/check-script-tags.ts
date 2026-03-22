/**
 * Diagnostic check: script tag validation (missing type="module" on inline scripts with imports).
 */
import * as vscode from "vscode";
import type { ParsedDocument } from "../document-analysis";
import { applyAeroDiagnosticIdentity } from "../diagnostic-metadata";
import { getIgnoredRanges, isInRanges, isInHead } from "./helpers";

export function checkScriptTags(
  document: vscode.TextDocument,
  text: string,
  diagnostics: vscode.Diagnostic[],
  parsed: ParsedDocument,
): void {
  const ignoredRanges = getIgnoredRanges(text);

  for (const block of parsed.scriptBlocks) {
    if (isInRanges(block.tagStart, ignoredRanges)) continue;
    if (block.kind === "external") continue;

    // Skip scripts in <head> that might be third-party
    if (isInHead(text, block.tagStart)) continue;

    // Check for imports in is:inline scripts (in body) without type="module"
    if (block.kind === "inline") {
      const hasImport = /\bimport\b/.test(block.content);
      const hasModuleType = /\btype\s*=\s*["']?module["']?\b/.test(block.attrs);

      if (hasImport && !hasModuleType) {
        const importMatch = /\bimport\b/.exec(block.content);
        if (importMatch) {
          const importStart = block.contentStart + importMatch.index;
          const importEnd = importStart + 6;
          const diagnostic = new vscode.Diagnostic(
            new vscode.Range(document.positionAt(importStart), document.positionAt(importEnd)),
            'Imports in <script is:inline> require type="module" attribute.',
            vscode.DiagnosticSeverity.Error,
          );
          applyAeroDiagnosticIdentity(diagnostic, "AERO_BUILD_SCRIPT", "script-taxonomy.md");
          diagnostics.push(diagnostic);
        }
      }
    }

    // Plain <script> without attributes are valid (bundled as module by default)
  }
}
