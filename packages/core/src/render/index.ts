import { parse } from "../parser/index.js";
import { layoutFlowchart } from "../layout/flowchart.js";
import { layoutSequence } from "../layout/sequence.js";
import { renderFlowchartToSvg } from "./flowchart.js";
import { renderSequenceToSvg } from "./sequence.js";
import type { BlockKind, DocumentUri } from "../ast.js";
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

export function render(source: string, uri: DocumentUri = ""): RenderResult {
  const { document, catalog, diagnostics } = parse(source, uri);
  const diagrams = document.blocks.map((block) => ({
    name: block.name,
    title: block.title,
    kind: block.kind,
    svg:
      block.kind === "flow"
        ? renderFlowchartToSvg(layoutFlowchart(block, catalog))
        : renderSequenceToSvg(layoutSequence(block, catalog)),
  }));
  return { diagrams, diagnostics };
}
