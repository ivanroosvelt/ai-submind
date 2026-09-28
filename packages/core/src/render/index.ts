import { parse } from "../parser/index.js";
import { layoutFlowchart } from "../layout/flowchart.js";
import { layoutSequence } from "../layout/sequence.js";
import { renderFlowchartToSvg } from "./flowchart.js";
import { renderSequenceToSvg } from "./sequence.js";
import { blockId } from "../workspace/xref.js";
import type { Catalog } from "../workspace/resolver.js";
import type { BlockKind, DiagramBlock, DocumentUri } from "../ast.js";
import type { Diagnostic } from "../diagnostics.js";

export interface RenderedDiagram {
  name: string;
  title: string | null;
  kind: BlockKind;
  svg: string;
}

export interface RenderResult {
  diagrams: RenderedDiagram[];
  diagnostics: Diagnostic[];
}

/** Un bloque de un documento ya linkeado, contra el catálogo alcanzable de ese documento. */
export function renderBlock(block: DiagramBlock, catalog: Catalog, uri: DocumentUri): RenderedDiagram {
  const origin = { uri, block: blockId(uri, block.name) };
  return {
    name: block.name,
    title: block.title,
    kind: block.kind,
    svg:
      block.kind === "flow"
        ? renderFlowchartToSvg(layoutFlowchart(block, catalog), origin)
        : renderSequenceToSvg(layoutSequence(block, catalog), origin),
  };
}

export function render(source: string, uri: DocumentUri = ""): RenderResult {
  const { document, catalog, diagnostics } = parse(source, uri);
  return { diagrams: document.blocks.map((block) => renderBlock(block, catalog, uri)), diagnostics };
}
