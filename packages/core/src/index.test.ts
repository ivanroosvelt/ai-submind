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
  query,
  tagCatalog,
  entityAt,
  renameEntity,
  renderMap,
  renderKnowledge,
  MEMORY_FILL,
  type BlockId,
  type FlowchartLayout,
  type LinkResult,
  type Location,
  type SequenceLayout,
  type KnowledgeMeta,
  type MemoryType,
  type Relation,
  type QueryResult,
  type TagCatalog,
  type TextEdit,
  type RenameResult,
  type RenderedMap,
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
      })
    ).toBe("E999 error [1:1]: prueba");
  });

  it("records the declaration range and the name range of an entity separately", () => {
    const entity = parse("entity start [Inicio]\n").document.entities[0];
    expect(entity.nameRange).toEqual({ start: { line: 1, column: 8 }, end: { line: 1, column: 13 } });
    expect(entity.range).toEqual({ start: { line: 1, column: 1 }, end: { line: 1, column: 22 } });
  });

  it("exposes entityAt and renameEntity", () => {
    const workspace = new Workspace();
    workspace.setDocument("a.flo", "entity a\nflow f {\n  a -> a\n}\n");
    const linked = workspace.link();
    expect(entityAt(linked.documents.get("a.flo")!.document, { line: 3, column: 3 })).toBe("a");
    const result: RenameResult = renameEntity(linked, "a", "b");
    const edits: TextEdit[] = "edits" in result ? result.edits.get("a.flo")! : [];
    expect(edits.map((edit) => edit.text)).toEqual(["b", "b", "b"]);
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

  it("links and renders a complete knowledge workspace through the public API", () => {
    const workspace = new Workspace();
    workspace.setDocument("catalogo.flo", "entity api [API Gateway]\n");
    workspace.setDocument(
      "decisiones/pkce.md",
      [
        "---",
        "id: pkce",
        'title: "Decisión: PKCE"',
        "memory_type: long_term",
        "type_tags: [decision]",
        'use: ["../catalogo.flo"]',
        "relations:",
        "  - target: api",
        "    type: affects",
        "  - target: ./pkce.md#validacion",
        "    type: visualized_by",
        "---",
        "",
        "```flo",
        'flow validacion "Validación" {',
        "  api -> pkce : code_verifier",
        "}",
        "```",
        "",
      ].join("\n")
    );
    const result = workspace.link();
    for (const list of result.diagnostics.values()) expect(list).toEqual([]);

    const knowledge: KnowledgeMeta = result.entities.get("pkce")!.knowledge!;
    const memory: MemoryType | null = knowledge.memoryType;
    const relations: Relation[] = result.xref.relationsFrom("pkce");
    expect(memory).toBe("long_term");
    expect(relations.map((relation) => relation.resolved)).toEqual([
      { kind: "entity", id: "api" },
      { kind: "block", id: "decisiones/pkce.md#validacion" },
    ]);

    const { document, catalog } = result.documents.get("decisiones/pkce.md")!;
    const svg = renderBlock(document.blocks[0], catalog, document.uri).svg;
    expect(svg).toContain('data-flo-entity="pkce"');
    expect(svg).toContain("Decisión: PKCE");
  });

  it("queries a knowledge workspace through the public API", () => {
    const workspace = new Workspace();
    workspace.setDocument("catalogo.flo", "entity api\n");
    workspace.setDocument(
      "pkce.md",
      '---\nid: pkce\ntitle: PKCE\nmemory_type: long_term\ntype_tags: [decision]\nuse: ["./catalogo.flo"]\nrelations:\n  - target: api\n    type: affects\n---\n'
    );
    const link = workspace.link();

    const result: QueryResult = query(link, { where: { typeTag: "decision" }, depth: 1 });
    expect(result.nodes.map((node) => [node.id, node.distance])).toEqual([["pkce", 0], ["api", 1]]);
    expect(result.edges).toEqual([{ from: "pkce", to: "api", type: "affects" }]);
    const tags: TagCatalog = tagCatalog(link);
    expect(tags.typeTags).toEqual(["decision"]);
  });

  it("exposes renderMap", () => {
    const workspace = new Workspace();
    workspace.setDocument("a.flo", "entity a\nentity b\nflow f {\n  a -> b\n}\n");
    const map: RenderedMap = renderMap(workspace.link());
    expect(map.edges).toHaveLength(1);
  });

  it("exposes renderKnowledge", () => {
    const workspace = new Workspace();
    workspace.setDocument("n.md", "---\nid: n\ntitle: N\nmemory_type: working\n---\n");
    const link = workspace.link();
    expect(renderKnowledge(link, query(link))).toContain(`fill="${MEMORY_FILL.working}"`);
  });
});
