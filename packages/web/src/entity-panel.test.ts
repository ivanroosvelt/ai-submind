import { describe, it, expect } from "vitest";
import { Workspace } from "@flo/core";
import { blockLabel, edgePanelHtml, entityPanelHtml } from "./entity-panel.js";

function linked(files: Record<string, string>) {
  const workspace = new Workspace();
  for (const [uri, source] of Object.entries(files)) workspace.setDocument(uri, source);
  return workspace.link();
}

const link = linked({
  "catalog.flo": "entity api [API <Gateway>] type: service, tags: http publico\nentity db\n",
  "login.flo": 'use "./catalog.flo"\nflow login "Inicio" {\n  api -> db\n}\nsequence detalle {\n  api -> db : q\n}\n',
});

describe("entity panel", () => {
  it("shows label, id, type, tags, definition and the flows that use the entity", () => {
    const html = entityPanelHtml(link, "api");
    expect(html).toContain("API &lt;Gateway&gt;");
    expect(html).toContain("<code>api</code> · service #http #publico");
    expect(html).toContain("catalog.flo:1");
    expect(html).toContain("Aparece en 2 flujos");
    expect(html).toContain('data-flo-block="login.flo#login"');
    expect(html).toContain('data-flo-block="login.flo#detalle"');
    expect(html).toContain("data-flo-rename");
  });

  it("uses the singular for one flow and labels blocks by title or name", () => {
    const one = linked({ "a.flo": "entity a\nflow f {\n  a -> a\n}\n" });
    expect(entityPanelHtml(one, "a")).toContain("Aparece en 1 flujo<");
    expect(blockLabel(link, "login.flo#login")).toBe("Inicio · login.flo");
    expect(blockLabel(link, "login.flo#detalle")).toBe("detalle · login.flo");
  });

  it("lists the flows of a map edge", () => {
    const html = edgePanelHtml(link, { from: "api", to: "db", type: "flow", blocks: ["login.flo#login", "login.flo#detalle"] });
    expect(html).toContain("API &lt;Gateway&gt; → db");
    expect(html).toContain("En 2 flujos");
    expect(html).toContain('data-flo-block="login.flo#detalle"');
  });
});
