import { describe, it, expect } from "vitest";
import { renderApp } from "./app";

describe("renderApp", () => {
  it("writes the core version into the root element", () => {
    const root = document.createElement("div");
    renderApp(root, "0.0.0");
    expect(root.textContent).toBe(".flo editor — core v0.0.0");
  });
});
