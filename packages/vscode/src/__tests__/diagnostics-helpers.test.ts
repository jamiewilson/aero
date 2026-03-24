import { describe, expect, it } from "vitest";
import { isInHead } from "../diagnostics/helpers";

describe("isInHead", () => {
  it("returns false after a closed head section", () => {
    const text = "<head><title>x</title></head><body><div>ok</div></body>";
    const position = text.indexOf("<div>");
    expect(isInHead(text, position)).toBe(false);
  });

  it("uses the latest head open/close before position", () => {
    const text = "<head></head><body><!-- noise --><head><script>import x from 'y'</script>";
    const scriptPosition = text.indexOf("<script>");
    expect(isInHead(text, scriptPosition)).toBe(true);
  });
});

