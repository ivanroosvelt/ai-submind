import { describe, it, expect } from "vitest";
import { render } from "@flo/core";
import { EXAMPLES } from "./examples.js";

describe("EXAMPLES", () => {
  it.each(EXAMPLES)("$id renders with no diagnostics", (example) => {
    const { diagrams, diagnostics } = render(example.source);
    expect(diagnostics).toEqual([]);
    expect(diagrams.length).toBeGreaterThan(0);
  });
});
