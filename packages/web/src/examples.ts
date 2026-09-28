import flowchart from "../../../examples/01-flowchart.flo?raw";
import sequence from "../../../examples/02-sequence.flo?raw";
import catalogo from "../../../examples/03-catalogo.flo?raw";

export interface Example {
  id: string;
  title: string;
  source: string;
}

// Los ejemplos son los archivos de examples/ en la raíz del repo, importados
// tal cual por Vite: no hay copia que mantener sincronizada.
export const EXAMPLES: Example[] = [
  { id: "flowchart", title: "Flowchart", source: flowchart },
  { id: "sequence", title: "Secuencia", source: sequence },
  { id: "catalogo", title: "Catálogo compartido", source: catalogo },
];
