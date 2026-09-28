import { describe, it, expect } from "vitest";
import {
  parse,
  render,
  renderBlock,
  formatDiagnostic,
  escapeXml,
  Workspace,
  blockId,
  layoutFlowchart,
  layoutSequence,
  type BlockId,
  type FlowchartLayout,
  type LinkResult,
  type Location,
  type SequenceLayout,
} from "./index.js";

describe("index", () => {
  it("exposes parse, render, formatDiagnostic and escapeXml", () => {
    expect(parse("entity a\n").document.entities).toHaveLength(1);
    expect(render("entity a\nflow f {\n  a -> a\n}\n").diagrams).toHaveLength(1);
    expect(escapeXml("<a>")).toBe("&lt;a&gt;");
    expect(
      formatDiagnostic({
        code: "E999",
        message: "prueba",
        range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
        severity: "error",
      })
    ).toBe("E999 error [1:1]: prueba");
  });

  it("records the declaration range and the name range of an entity separately", () => {
    const entity = parse("entity start [Inicio]\n").document.entities[0];
    expect(entity.nameRange).toEqual({ start: { line: 1, column: 8 }, end: { line: 1, column: 13 } });
    expect(entity.range).toEqual({ start: { line: 1, column: 1 }, end: { line: 1, column: 22 } });
  });
});

describe("index: navigation surface (Fase E)", () => {
  const catalog = "entity user [Usuario]\nentity api [API]\n";
  const login = 'use "./catalog.flo"\n\nflow login {\n  user -> api\n}\n\nsequence handshake {\n  user -> api : hola\n}\n';

  function linked(): LinkResult {
    const workspace = new Workspace();
    workspace.setDocument("catalog.flo", catalog);
    workspace.setDocument("login.flo", login);
    return workspace.link();
  }

  it("links a multi-document workspace and answers cross-reference queries", () => {
    const result = linked();
    expect([...result.diagnostics.values()].flat()).toEqual([]);

    const flows: BlockId[] = result.xref.flowsUsing("api");
    expect(flows).toEqual([blockId("login.flo", "login"), blockId("login.flo", "handshake")]);
    const definition: Location | null = result.xref.definitionOf("api");
    expect(definition?.uri).toBe("catalog.flo");
  });

  it("exposes the layout of a block from a linked document", () => {
    const { document, catalog: reachable } = linked().documents.get("login.flo")!;

    const flow: FlowchartLayout = layoutFlowchart(document.blocks[0], reachable);
    const sequence: SequenceLayout = layoutSequence(document.blocks[1], reachable);

    expect(flow.nodes.map((n) => [n.id, n.label, n.range.start.line])).toEqual([
      ["user", "Usuario", 4],
      ["api", "API", 4],
    ]);
    expect(sequence.participants.map((p) => p.id)).toEqual(["user", "api"]);
  });

  it("renders a block of a linked document with its data-flo-* annotations", () => {
    const { document, catalog: reachable } = linked().documents.get("login.flo")!;
    const diagram = renderBlock(document.blocks[0], reachable, "login.flo");
    expect(diagram).toMatchObject({ name: "login", title: null, kind: "flow" });
    expect(diagram.svg).toContain(
      'data-flo-entity="api" data-flo-block="login.flo#login" data-flo-uri="login.flo" data-flo-line="4"'
    );
  });

  it("renders a single document the same through render() and through a one-document workspace", () => {
    const source = "entity a [A]\nentity b {B?}\nflow f {\n  a -> b : si\n}\n";
    const workspace = new Workspace();
    workspace.setDocument("solo.flo", source);
    const { document, catalog: reachable } = workspace.link().documents.get("solo.flo")!;

    expect(renderBlock(document.blocks[0], reachable, "solo.flo").svg).toBe(render(source, "solo.flo").diagrams[0].svg);
  });
});
