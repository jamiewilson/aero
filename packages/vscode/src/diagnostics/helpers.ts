/**
 * Shared diagnostic helpers: HTML comment/script masking, position checks.
 */
import { getIgnoredRanges, isInRanges, type IgnoredRange } from "../utils";

export { getIgnoredRanges, isInRanges, type IgnoredRange };

/** Check whether a position in the document is inside a `<head>` element. */
export function isInHead(text: string, position: number): boolean {
  const beforeText = text.slice(0, position);
  const headOpenMatch = beforeText.match(/<head(?:\s|>)/);
  const headCloseMatch = beforeText.match(/<\/head\s*>/);
  const headOpen = headOpenMatch?.index ?? -1;
  const headClose = headCloseMatch?.index ?? -1;
  return headOpen > headClose;
}
