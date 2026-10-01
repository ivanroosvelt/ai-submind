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
    let file: string | null = null;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      file = this.download;
    });
    const createUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");

    exportSvg("<svg>x</svg>", "login");

    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    const blob = createUrlSpy.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("image/svg+xml");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(file).toBe("login.svg");
  });
});
