import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "../src/index.js";

describe("andamiaje", () => {
  it("expone el nombre del paquete", () => {
    expect(PACKAGE_NAME).toBe("ai-submind");
  });
});
