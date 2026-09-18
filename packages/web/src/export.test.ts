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
  it("encodes the svg as a base64 data URL", () => {
    expect(svgDataUrl("<svg>x</svg>")).toBe(`data:image/svg+xml;base64,${btoa("<svg>x</svg>")}`);
  });
});

describe("exportSvg", () => {
  it("downloads the svg as a diagrama.svg file", () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");

    exportSvg("<svg>x</svg>");

    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    const blob = createUrlSpy.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("image/svg+xml");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
