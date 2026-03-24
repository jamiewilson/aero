import * as vscode from "vscode";
import { maskJsComments } from "../analyzer";
import type { ParsedDocument } from "../document-analysis";
import { applyAeroDiagnosticIdentity } from "../diagnostic-metadata";

export function checkUnusedVariables(
  parsed: ParsedDocument,
  diagnostics: vscode.Diagnostic[],
): void {
  const usedInTemplate = new Set<string>();
  for (const ref of parsed.templateReferences) {
    usedInTemplate.add(ref.content);
  }

  const propsValueRegex = /(?:props|data-props)\s*=\s*(['"])([\s\S]*?)\1/gi;
  let pdMatch: RegExpExecArray | null;
  while ((pdMatch = propsValueRegex.exec(parsed.text)) !== null) {
    const value = pdMatch[2];
    const identifiers = value.match(/\b([a-zA-Z_$][\w$]*)\b/g);
    if (identifiers) {
      for (const name of identifiers) {
        usedInTemplate.add(name);
      }
    }
  }

  checkUnusedInScope(parsed, "build", usedInTemplate, diagnostics);
  checkUnusedInScope(parsed, "bundled", usedInTemplate, diagnostics);
  checkUnusedInScope(parsed, "inline", usedInTemplate, diagnostics);
  checkUnusedInScope(parsed, "blocking", usedInTemplate, diagnostics);
}

function checkUnusedInScope(
  parsed: ParsedDocument,
  scope: "build" | "bundled" | "inline" | "blocking",
  usedInTemplate: Set<string>,
  diagnostics: vscode.Diagnostic[],
): void {
  const definedVars = parsed.variablesByScope[scope];
  const scopeContent = parsed.scriptContentByScope[scope];
  const maskedContent = maskJsComments(scopeContent).replace(/(['"])(?:(?=(\\?))\2.)*?\1/g, () =>
    " ".repeat(20),
  );

  for (const [name, def] of definedVars) {
    if (scope === "build") {
      if (usedInTemplate.has(name)) continue;

      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const usageRegex = new RegExp(`\\b${escapedName}\\b`, "g");
      const matches = maskedContent.match(usageRegex);
      if (matches && matches.length > 1) continue;
    } else if (scope === "bundled" || scope === "blocking") {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const usageRegex = new RegExp(`\\b${escapedName}\\b`, "g");
      const matches = maskedContent.match(usageRegex);
      if (def.kind === "reference") {
        if (matches && matches.length >= 1) continue;
      } else {
        if (matches && matches.length > 1) continue;
      }
    } else {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const usageRegex = new RegExp(`\\b${escapedName}\\b`, "g");
      const matches = maskedContent.match(usageRegex);
      if (matches && matches.length > 1) continue;
    }

    const diagnostic = new vscode.Diagnostic(
      def.range,
      `'${name}' is declared but its value is never read.`,
      vscode.DiagnosticSeverity.Hint,
    );
    diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
    applyAeroDiagnosticIdentity(diagnostic, "AERO_COMPILE", "interpolation.md");
    diagnostics.push(diagnostic);
  }
}
