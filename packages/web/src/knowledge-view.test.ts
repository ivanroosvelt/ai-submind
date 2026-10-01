import { describe, it, expect } from "vitest";
import { MEMORY_FILL, Workspace, tagCatalog } from "@flo/core";
import { DEFAULT_GRAPH, filterOf, graphBarHtml, graphHtml, readBar, whereOf, type GraphFilter } from "./knowledge-view.js";

const EMPTY: GraphFilter = { memory: null, typeTag: null, contextTag: null, text: "" };

function linkOf(files: Record<string, string>) {
  const workspace = new Workspace();
  for (const [uri, source] of Object.entries(files)) workspace.setDocument(uri, source);
  return workspace.link();
}

const link = linkOf({
  "n.md": '---\nid: n\ntitle: "Nota <1>"\nmemory_type: working\ntype_tags: [decision]\ncontext_tags: ["project:\\"x\\""]\n---\n',
});

describe("whereOf / filterOf", () => {
  it("always seeds from knowledge entities with a base text predicate", () => {
    expect(whereOf(EMPTY)).toEqual({ and: [{ text: "" }] });
    expect(DEFAULT_GRAPH.where).toEqual(whereOf(EMPTY));
  });

  it("adds one predicate per chosen control and reads it back", () => {
    const filter: GraphFilter = { memory: "working", typeTag: "decision", contextTag: "project:", text: "pkce" };
    const where = whereOf(filter);
    expect(where).toEqual({ and: [{ text: "pkce" }, { memory: "working" }, { typeTag: "decision" }, { contextTag: "project:" }] });
    expect(filterOf(where)).toEqual(filter);
  });

  it("does not read a where the bar could not have built", () => {
    expect(filterOf({ memory: "working" })).toBeNull();
    expect(filterOf({ and: [{ memory: "working" }] })).toBeNull(); // sin texto base
    expect(filterOf({ and: [{ text: "" }, { or: [] }] })).toBeNull();
    expect(filterOf({ and: [{ text: "" }, { memory: "working" }, { memory: "long_term" }] })).toBeNull();
  });
});

describe("graphBarHtml", () => {
  const bar = (graph = DEFAULT_GRAPH, presets: string[] | null = null) => {
    const div = document.createElement("div");
    div.innerHTML = graphBarHtml(link, tagCatalog(link), graph, presets);
    return div;
  };

  it("offers the memory types, tags in use and depths, and reads them back", () => {
    const div = bar({ ...DEFAULT_GRAPH, where: whereOf({ ...EMPTY, typeTag: "decision", text: 'a "b"' }), depth: 2 });
    expect([...div.querySelectorAll('[data-flo-kg="memory"] option')].map((o) => o.getAttribute("value"))).toEqual([
      "",
      "working",
      "short_term",
      "long_term",
    ]);
    expect(readBar(div)).toEqual({ filter: { ...EMPTY, typeTag: "decision", text: 'a "b"' }, depth: 2 });
    expect(div.querySelector<HTMLSelectElement>('[data-flo-kg="contextTag"]')!.options[1].value).toBe('project:"x"');
  });

  it("keeps a selected value that is no longer in use", () => {
    const div = bar({ ...DEFAULT_GRAPH, where: whereOf({ ...EMPTY, typeTag: "borrado" }) });
    expect(readBar(div).filter.typeTag).toBe("borrado");
  });

  it("says when the where comes from a view the bar cannot show", () => {
    expect(bar({ ...DEFAULT_GRAPH, where: { or: [] } }).textContent).toContain("Filtro de la vista");
    expect(bar().textContent).not.toContain("Filtro de la vista");
  });

  it("shows the seeds with a button to clear them", () => {
    const div = bar({ ...DEFAULT_GRAPH, from: ["n", "fantasma"] });
    expect(div.querySelector("[data-flo-kg-clear-from]")!.textContent).toBe("Centrado en Nota <1>, fantasma ×");
    expect(bar().querySelector("[data-flo-kg-clear-from]")).toBeNull();
  });

  it("offers views only when presets are available", () => {
    expect(bar().querySelector('[data-flo-kg="preset"]')).toBeNull();
    const div = bar(DEFAULT_GRAPH, ["a", "b"]);
    expect([...div.querySelectorAll('[data-flo-kg="preset"] option')].map((o) => o.textContent)).toEqual(["Vistas", "a", "b"]);
    expect(div.querySelector("[data-flo-kg-save]")).not.toBeNull();
  });

  it("has a legend with the memory colors", () => {
    expect(bar().querySelector(".flo-kg-legend")!.innerHTML).toContain(MEMORY_FILL.long_term);
  });
});

describe("graphHtml", () => {
  it("wraps the svg, or says nothing matched", () => {
    expect(graphHtml("<svg></svg>", false)).toContain('<section class="flo-block flo-kg">');
    expect(graphHtml("<svg></svg>", true)).toContain("Ninguna nota coincide con el filtro");
    expect(graphHtml("<svg></svg>", true)).not.toContain("<svg");
  });
});
