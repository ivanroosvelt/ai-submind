import { describe, it, expect, vi } from "vitest";
import { bindExplorer, explorerHtml, type ExplorerActions } from "./explorer.js";
import { EditorWorkspace } from "./workspace.js";

const ws = () =>
  new EditorWorkspace({
    files: {
      "catalog.flo": "entity api [API] type: service, tags: http\nentity db type: store\nentity web tags: http ui\n",
      "login.flo": 'use "./catalog.flo"\nflow login "Inicio <1>" {\n  api -> db\n}\nsequence s {\n  web -> api : x\n}\n',
    },
    saved: { "catalog.flo": "entity api\n" },
    active: "login.flo",
    dir: null,
  });

const container = (html: string) => {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
};

const entities = (html: string) =>
  Array.from(container(html).querySelectorAll("[data-flo-entity]")).map((e) => e.getAttribute("data-flo-entity"));

describe("explorerHtml", () => {
  it("lists the catalog in order and every file with its blocks", () => {
    const html = explorerHtml(ws(), { type: null, tag: null }, "login.flo#s");
    expect(entities(html)).toEqual(["api", "db", "web"]);
    const div = container(html);
    expect(Array.from(div.querySelectorAll("[data-flo-open]")).map((e) => e.getAttribute("data-flo-open"))).toEqual([
      "catalog.flo",
      "login.flo",
    ]);
    expect(html).toContain("Inicio &lt;1&gt;");
    expect(div.querySelector('[data-flo-open="login.flo"]')!.classList.contains("flo-active")).toBe(true);
    expect(div.querySelector('[data-flo-block="login.flo#s"]')!.classList.contains("flo-selected")).toBe(true);
    expect(div.querySelector('[data-flo-open="catalog.flo"] .flo-dirty')).not.toBeNull();
  });

  it("filters the catalog by type and by tag", () => {
    expect(entities(explorerHtml(ws(), { type: "service", tag: null }, null))).toEqual(["api"]);
    expect(entities(explorerHtml(ws(), { type: null, tag: "http" }, null))).toEqual(["api", "web"]);
    expect(entities(explorerHtml(ws(), { type: "store", tag: "http" }, null))).toEqual([]);
  });

  it("offers the types and tags present, and ignores a filter value that no longer exists", () => {
    const div = container(explorerHtml(ws(), { type: "borrado", tag: null }, null));
    const values = (name: string) =>
      Array.from(div.querySelectorAll(`select[data-flo-filter="${name}"] option`)).map((o) => (o as HTMLOptionElement).value);
    expect(values("type")).toEqual(["", "service", "store"]);
    expect(values("tag")).toEqual(["", "http", "ui"]);
    expect(entities(div.innerHTML)).toEqual(["api", "db", "web"]);
  });
});

describe("bindExplorer", () => {
  it("routes clicks and filter changes to the actions", () => {
    const div = container(explorerHtml(ws(), { type: null, tag: null }, null));
    const actions: ExplorerActions = {
      onOpenDocument: vi.fn(),
      onSelectBlock: vi.fn(),
      onSelectEntity: vi.fn(),
      onFilter: vi.fn(),
    };
    bindExplorer(div, actions);
    (div.querySelector('[data-flo-open="catalog.flo"] .flo-dirty') as HTMLElement).click();
    (div.querySelector('[data-flo-block="login.flo#login"]') as HTMLElement).click();
    (div.querySelector('[data-flo-entity="db"]') as HTMLElement).click();
    const type = div.querySelector<HTMLSelectElement>('select[data-flo-filter="type"]')!;
    type.value = "store";
    type.dispatchEvent(new Event("change", { bubbles: true }));
    expect(actions.onOpenDocument).toHaveBeenCalledWith("catalog.flo");
    expect(actions.onSelectBlock).toHaveBeenCalledWith("login.flo#login");
    expect(actions.onSelectEntity).toHaveBeenCalledWith("db");
    expect(actions.onFilter).toHaveBeenCalledWith({ type: "store", tag: null });
  });
});
