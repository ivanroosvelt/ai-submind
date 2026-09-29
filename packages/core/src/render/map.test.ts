import { describe, it, expect } from "vitest";
import { Workspace } from "../workspace/workspace.js";
import { renderMap } from "./map.js";

function mapOf(files: Record<string, string>) {
  const workspace = new Workspace();
  for (const [uri, source] of Object.entries(files)) workspace.setDocument(uri, source);
  return renderMap(workspace.link());
}

const files = {
  "catalog.flo": "entity api [API Gateway]\nentity db\nentity cache\nentity solo\n",
  "login.flo": 'use "./catalog.flo"\nflow login {\n  api -> db\n  db -> api\n}\nsequence detalle {\n  api -> cache : get\n  api -> ghost : x\n}\n',
  "admin.flo": 'use "./catalog.flo"\nflow admin {\n  api -> db\n}\n',
};

const count = (text: string, part: string) => text.split(part).length - 1;

describe("renderMap", () => {
  const map = mapOf(files);

  it("lists one flow edge per directed pair, with the blocks that contain it", () => {
    expect(map.edges).toEqual([
      { from: "api", to: "db", type: "flow", blocks: ["admin.flo#admin", "login.flo#login"] },
      { from: "db", to: "api", type: "flow", blocks: ["login.flo#login"] },
      { from: "api", to: "cache", type: "flow", blocks: ["login.flo#detalle"] },
    ]);
  });

  it("draws each pair once, with the entity labels and the #mapa block", () => {
    expect(count(map.svg, 'data-flo-from="api" data-flo-to="db"')).toBe(1);
    expect(count(map.svg, 'data-flo-from="db" data-flo-to="api"')).toBe(1);
    expect(map.svg).toContain(">API Gateway<");
    expect(map.svg).toContain('data-flo-block="#mapa"');
  });

  it("leaves out entities without edges and unresolved references", () => {
    expect(map.svg).not.toContain('data-flo-entity="solo"');
    expect(map.svg).not.toContain("ghost");
  });

  it("gives an empty map for a workspace without flow edges", () => {
    const empty = mapOf({ "a.flo": "entity a\n" });
    expect(empty.edges).toEqual([]);
    expect(empty.svg).toContain('width="0"');
  });
});
