/**
 * Diagnostic check: missing component/layout files.
 */
import * as vscode from "vscode";
import * as fs from "node:fs";
import { COMPONENT_SUFFIX_REGEX } from "../constants";
import { applyAeroDiagnosticIdentity } from "../diagnostic-metadata";
import type { PathResolver } from "../pathResolver";
import { kebabToCamelCase, collectImportedSpecifiersFromDocument } from "../utils";
import { getIgnoredRanges, isInRanges } from "./helpers";

/** Matches opening tags with component/layout suffix */
const COMPONENT_TAG_OPEN_REGEX =
  /<([a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:component|layout))\b[^>]*\/?>/gi;

export function checkComponentReferences(
  document: vscode.TextDocument,
  text: string,
  diagnostics: vscode.Diagnostic[],
  resolver: PathResolver,
): void {
  const imports = collectImportedSpecifiersFromDocument(text);
  const ignoredRanges = getIgnoredRanges(text);

  COMPONENT_TAG_OPEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = COMPONENT_TAG_OPEN_REGEX.exec(text)) !== null) {
    const tagStart = match.index;
    if (isInRanges(tagStart, ignoredRanges)) continue;

    const tagName = match[1];
    const suffixMatch = COMPONENT_SUFFIX_REGEX.exec(tagName);
    if (!suffixMatch) continue;

    const suffix = suffixMatch[1] as "component" | "layout";
    const baseName = tagName.replace(COMPONENT_SUFFIX_REGEX, "");
    const importName = kebabToCamelCase(baseName);
    const importedSpecifier = imports.get(importName);

    if (!importedSpecifier) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(startPos, endPos),
        `Component '${baseName}' is not imported. Explicit imports are required.`,
        vscode.DiagnosticSeverity.Error,
      );
      applyAeroDiagnosticIdentity(diagnostic, "AERO_RESOLVE", "importing-and-bundling.md");
      diagnostics.push(diagnostic);
      continue;
    }

    const resolved = resolver.resolve(importedSpecifier, document.uri.fsPath);
    const resolvedExists =
      resolved &&
      (fs.existsSync(resolved) ||
        (!resolved.endsWith(".html") && fs.existsSync(resolved + ".html")));
    if (resolved && !resolvedExists) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(startPos, endPos),
        `${suffix === "component" ? "Component" : "Layout"} file not found: ${baseName}.html`,
        vscode.DiagnosticSeverity.Warning,
      );
      applyAeroDiagnosticIdentity(diagnostic, "AERO_RESOLVE", "tsconfig-aliases.md");
      diagnostics.push(diagnostic);
    }
  }
}
