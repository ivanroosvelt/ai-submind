import { describe, it, expect, vi, afterEach } from "vitest";
import { parseSvgSize, svgDataUrl, exportSvg } from "./export.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseSvgSize", () => {
  it("reads width and height from the svg root element", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="272" height="340" viewBox="0 0 272 340"></svg>';
    expect(parseSvgSize(svg)).toEqual({ width: 272, height: 340 });
  });

  it("throws when the svg has no width/height attributes", () => {
    expect(() => parseSvgSize("<svg></svg>")).toThrow();
  });
});

describe("svgDataUrl", () => {
  it("encodes the svg as a utf-8 data URL, accents included", () => {
    const svg = "<svg>ñandú</svg>";
    const url = svgDataUrl(svg);
    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(url.slice("data:image/svg+xml;charset=utf-8,".length))).toBe(svg);
  });
});

describe("exportSvg", () => {
  it("downloads the svg named after the block (#57)", () => {
    let name: string | null = null;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      name = this.download;
    });
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");

    exportSvg("<svg/>", "login");

    expect(name).toBe("login.svg");
    expect(click).toHaveBeenCalledTimes(1);
    expect((create.mock.calls[0][0] as Blob).type).toBe("image/svg+xml");
  });
});
