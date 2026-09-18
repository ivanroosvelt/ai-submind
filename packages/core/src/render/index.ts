import { parse } from "../parser/index.js";
import { layoutFlowchart } from "../layout/flowchart.js";
import { layoutSequence } from "../layout/sequence.js";
import { renderFlowchartToSvg } from "./flowchart.js";
import { renderSequenceToSvg } from "./sequence.js";
import type { Diagnostic } from "../diagnostics.js";

export interface RenderResult {
  svg: string | null;
  diagnostics: Diagnostic[];
}

export function render(source: string): RenderResult {
  const { diagram, diagnostics } = parse(source);

  if (diagram === null) {
    return { svg: null, diagnostics };
  }

  switch (diagram.kind) {
    case "flowchart": {
      const layout = layoutFlowchart(diagram);
      return { svg: renderFlowchartToSvg(diagram, layout), diagnostics };
    }
    case "sequence": {
      const layout = layoutSequence(diagram);
      return { svg: renderSequenceToSvg(diagram, layout), diagnostics };
    }
  }
}
