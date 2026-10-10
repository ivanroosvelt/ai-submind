import { describe, it, expect } from "vitest";
import { applyFocus, bindFocus, DENSE_EDGES } from "./focus.js";

function svgOf(edges: [string, string][]): SVGSVGElement {
  const ids = [...new Set(edges.flat())];
  const host = document.createElement("div");
  host.innerHTML =
    "<svg>" +
    ids.map((id) => `<g data-flo-entity="${id}"><rect /></g>`).join("") +
    edges.map(([a, b]) => `<polyline data-flo-from="${a}" data-flo-to="${b}" />`).join("") +
    edges.map(([a, b]) => `<g class="flo-kg-label" data-flo-from="${a}" data-flo-to="${b}"></g>`).join("") +
    "</svg>";
  return host.querySelector("svg")!;
}

const near = (svg: Element) =>
  [...svg.querySelectorAll("g[data-flo-entity].flo-near")].map((g) => g.getAttribute("data-flo-entity"));

describe("applyFocus", () => {
  it("marks the node, its neighbours and its edges, and dims the rest", () => {
    const svg = svgOf([
      ["a", "b"],
      ["c", "a"],
      ["c", "d"],
    ]);
    applyFocus(svg, "a");
    expect(svg.classList.contains("flo-dim")).toBe(true);
    expect(near(svg)).toEqual(["a", "b", "c"]);
    expect(svg.querySelectorAll("polyline.flo-near")).toHaveLength(2);
    expect(svg.querySelectorAll(".flo-kg-label.flo-near")).toHaveLength(2);
    applyFocus(svg, null);
    expect(svg.classList.contains("flo-dim")).toBe(false);
    expect(svg.querySelectorAll(".flo-near")).toHaveLength(0);
  });
});

describe("bindFocus", () => {
  it("follows the pointer and returns to the pinned node", () => {
    const svg = svgOf([
      ["a", "b"],
      ["c", "d"],
    ]);
    bindFocus(svg, () => "a");
    expect(near(svg)).toEqual(["a", "b"]);
    svg.querySelector('[data-flo-entity="c"] rect')!.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(near(svg)).toEqual(["c", "d"]);
    svg.dispatchEvent(new MouseEvent("pointerleave"));
    expect(near(svg)).toEqual(["a", "b"]);
  });

  it("marks a dense graph", () => {
    const edges = Array.from({ length: DENSE_EDGES + 1 }, (_, i) => [`n${i}`, `n${i + 1}`] as [string, string]);
    const svg = svgOf(edges);
    bindFocus(svg, () => null);
    expect(svg.classList.contains("flo-dense")).toBe(true);
    expect(svg.classList.contains("flo-dim")).toBe(false);
  });
});
