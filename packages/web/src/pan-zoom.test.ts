import { describe, it, expect, vi } from "vitest";
import { bindPanZoom, panViewBox, parseViewBox, zoomViewBox } from "./pan-zoom.js";

describe("viewBox math", () => {
  it("parses a viewBox attribute", () => {
    expect(parseViewBox("0 0 100 50")).toEqual([0, 0, 100, 50]);
    expect(parseViewBox(null)).toBeNull();
    expect(parseViewBox("0 0 x 1")).toBeNull();
  });

  it("zooms around a point that stays still", () => {
    expect(zoomViewBox([0, 0, 100, 50], 2, 50, 25)).toEqual([25, 12.5, 50, 25]);
    expect(zoomViewBox([0, 0, 100, 50], 0.5, 0, 0)).toEqual([0, 0, 200, 100]);
  });

  it("pans against the drag direction", () => {
    expect(panViewBox([10, 10, 100, 50], 5, -5)).toEqual([5, 15, 100, 50]);
  });
});

function setup() {
  const parent = document.createElement("div");
  parent.innerHTML = '<svg viewBox="0 0 100 50"><g data-flo-entity="a"><rect /></g></svg>';
  document.body.appendChild(parent);
  const svg = parent.querySelector("svg")!;
  const onChange = vi.fn();
  bindPanZoom(svg, onChange);
  const parentClick = vi.fn();
  parent.addEventListener("click", parentClick);
  return { svg, onChange, parentClick, node: svg.querySelector("rect")! };
}

const mouse = (target: Element, type: string, x: number, y = 0) =>
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));

describe("bindPanZoom", () => {
  it("zooms in with the wheel (jsdom has no layout: 1 px = 1 unit)", () => {
    const { svg, onChange } = setup();
    svg.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -100, clientX: 0, clientY: 0 }));
    const expected = zoomViewBox([0, 0, 100, 50], 1.1, 0, 0);
    expect(parseViewBox(svg.getAttribute("viewBox"))).toEqual(expected);
    expect(onChange).toHaveBeenLastCalledWith(expected);
  });

  it("pans while dragging with the main button", () => {
    const { svg, onChange } = setup();
    mouse(svg, "mousedown", 10);
    mouse(svg, "mousemove", 30, 10);
    mouse(svg, "mouseup", 30, 10);
    expect(svg.getAttribute("viewBox")).toBe("-20 -10 100 50");
    expect(onChange).toHaveBeenLastCalledWith([-20, -10, 100, 50]);
  });

  it("swallows the click that ends a drag, but not a still click", () => {
    const { svg, parentClick, node } = setup();
    mouse(node, "mousedown", 0);
    mouse(svg, "mousemove", 10);
    mouse(node, "mouseup", 10);
    mouse(node, "click", 10);
    expect(parentClick).not.toHaveBeenCalled();
    mouse(node, "mousedown", 10);
    mouse(node, "mouseup", 11);
    mouse(node, "click", 11);
    expect(parentClick).toHaveBeenCalledTimes(1);
  });

  it("ignores moves without a pressed button", () => {
    const { svg, onChange } = setup();
    mouse(svg, "mousemove", 30);
    expect(onChange).not.toHaveBeenCalled();
  });
});
