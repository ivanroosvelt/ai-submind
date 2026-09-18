import { describe, it, expect } from "vitest";
import { VERSION } from "./index";

describe("index", () => {
  it("exports a version string", () => {
    expect(VERSION).toBe("0.0.0");
  });
});
