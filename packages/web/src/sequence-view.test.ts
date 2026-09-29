import { describe, it, expect } from "vitest";
import { enhanceSequencePreview } from "./sequence-view.js";

describe("enhanceSequencePreview", () => {
  it("adds a sticky header svg cloned from the participant boxes", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<svg width="320" height="170">' +
      '<g><g class="flo-seq-header-box"><rect width="140" height="50" /><text>Alice</text></g><line /></g>' +
      "</svg>";

    enhanceSequencePreview(container);

    const sticky = container.querySelector(".flo-seq-sticky");
    expect(sticky).not.toBeNull();
    const headerSvg = sticky!.querySelector("svg")!;
    expect(headerSvg.getAttribute("width")).toBe("320");
    expect(headerSvg.getAttribute("height")).toBe("50");
    expect(headerSvg.querySelector("text")?.textContent).toBe("Alice");

    const background = headerSvg.querySelector("rect");
    expect(background?.getAttribute("width")).toBe("320");
    expect(background?.getAttribute("height")).toBe("50");
    expect(background?.getAttribute("fill")).toBe("#ffffff");
    expect(headerSvg.firstElementChild).toBe(background);
  });

  it("extends the sticky header upward to cover the scroll container's top padding", () => {
    const container = document.createElement("div");
    container.style.paddingTop = "16px";
    container.innerHTML =
      '<svg width="320" height="170">' +
      '<g><g class="flo-seq-header-box"><rect width="140" height="50" /><text>Alice</text></g><line /></g>' +
      "</svg>";

    enhanceSequencePreview(container);

    const sticky = container.querySelector(".flo-seq-sticky") as HTMLElement;
    expect(sticky.style.top).toBe("-16px");
    const headerSvg = sticky.querySelector("svg")!;
    expect(headerSvg.getAttribute("height")).toBe("66");
    expect(headerSvg.getAttribute("viewBox")).toBe("0 -16 320 66");
    const background = headerSvg.querySelector("rect");
    expect(background?.getAttribute("y")).toBe("-16");
    expect(background?.getAttribute("height")).toBe("66");
  });

  it("does nothing when the preview has no sequence headers (flowchart or empty)", () => {
    const container = document.createElement("div");
    container.innerHTML = '<svg width="100" height="100"><rect /></svg>';

    enhanceSequencePreview(container);

    expect(container.querySelector(".flo-seq-sticky")).toBeNull();
  });

  it("adds one sticky per block section when the preview has several blocks, without reprocessing the inserted headers", () => {
    const container = document.createElement("div");
    const sequenceSvg =
      '<svg width="320" height="170">' +
      '<g><g class="flo-seq-header-box"><rect width="140" height="50" /><text>Alice</text></g><line /></g>' +
      "</svg>";
    container.innerHTML =
      `<section class="flo-block">${sequenceSvg}</section>` + `<section class="flo-block">${sequenceSvg}</section>`;

    enhanceSequencePreview(container);

    const stickies = container.querySelectorAll(".flo-seq-sticky");
    expect(stickies).toHaveLength(2);
    container.querySelectorAll("section.flo-block").forEach((section) => {
      expect(section.querySelectorAll(".flo-seq-sticky")).toHaveLength(1);
    });
  });

  it("copies the participant's data-flo-* attributes onto the sticky clone", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<svg width="320" height="170">' +
      '<g class="flo-unresolved" data-flo-entity="api" data-flo-block="a.flo#s"><g class="flo-seq-header-box"><rect width="140" height="50" /></g><line /></g>' +
      "</svg>";
    enhanceSequencePreview(container);
    const clone = container.querySelector(".flo-seq-sticky .flo-seq-header-box")!;
    expect(clone.getAttribute("data-flo-entity")).toBe("api");
    expect(clone.getAttribute("data-flo-block")).toBe("a.flo#s");
    expect(clone.classList.contains("flo-unresolved")).toBe(true);
  });
});
