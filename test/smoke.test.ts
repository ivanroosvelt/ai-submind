import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "../src/index.js";

describe("scaffolding", () => {
  it("exposes the package name", () => {
    expect(PACKAGE_NAME).toBe("ai-submind");
  });
});
