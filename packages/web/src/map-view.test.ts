import { describe, it, expect } from "vitest";
import { Workspace, renderMap } from "@tejo/core";
import { addEdgeHitAreas, mapHtml } from "./map-view.js";

function mapOf(files: Record<string, string>) {
  const workspace = new Workspace();
  for (const [uri, source] of Object.entries(files)) workspace.setDocument(uri, source);
  return renderMap(workspace.link());
}

describe("map view", () => {
  it("wraps the map svg in a titled section", () => {
    const html = mapHtml(mapOf({ "a.flo": "entity a\nentity b\nflow f {\n  a -> b\n}\n" }));
    expect(html).toContain("Mapa del sistema");
    expect(html).toContain('data-flo-from="a"');
  });

  it("says so when no flow connects entities", () => {
    const html = mapHtml(mapOf({ "a.flo": "entity a\n" }));
    expect(html).toContain("Ningún flujo conecta entidades todavía");
    expect(html).not.toContain("<svg");
  });

  it("adds a wide transparent hit area over each edge", () => {
    const div = document.createElement("div");
    div.innerHTML = mapHtml(mapOf({ "a.flo": "entity a\nentity b\nflow f {\n  a -> b\n}\n" }));
    addEdgeHitAreas(div);
    const hit = div.querySelector("polyline.flo-map-hit")!;
    expect(hit.getAttribute("data-flo-from")).toBe("a");
    expect(hit.getAttribute("stroke")).toBe("transparent");
    expect(hit.getAttribute("stroke-width")).toBe("12");
    expect(hit.hasAttribute("marker-end")).toBe(false);
  });
});
