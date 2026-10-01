import type { DocumentUri } from "@flo/core";
import flowchart from "../../../examples/01-flowchart.flo?raw";
import sequence from "../../../examples/02-sequence.flo?raw";
import catalogo from "../../../examples/03-catalogo.flo?raw";
import kgLogin from "../../../examples/04-conocimiento/login.flo?raw";
import kgPkce from "../../../examples/04-conocimiento/decisiones/pkce.md?raw";
import kgPasswords from "../../../examples/04-conocimiento/reglas/passwords.md?raw";
import kgIncidente from "../../../examples/04-conocimiento/incidentes/caida-auth.md?raw";
import kgNotas from "../../../examples/04-conocimiento/notas-de-trabajo.md?raw";

/** Un ejemplo es un workspace sin carpeta: uno o varios archivos y el activo. */
export interface Example {
  id: string;
  title: string;
  files: Record<DocumentUri, string>;
  active: DocumentUri;
}

const single = (id: string, title: string, source: string): Example => ({
  id,
  title,
  files: { [`${id}.flo`]: source },
  active: `${id}.flo`,
});

// Los ejemplos son los archivos de examples/ en la raíz del repo, importados
// tal cual por Vite: no hay copia que mantener sincronizada.
export const EXAMPLES: Example[] = [
  single("flowchart", "Flowchart", flowchart),
  single("sequence", "Secuencia", sequence),
  single("catalogo", "Catálogo compartido", catalogo),
  {
    id: "conocimiento",
    title: "Grafo de conocimiento",
    files: {
      "login.flo": kgLogin,
      "decisiones/pkce.md": kgPkce,
      "reglas/passwords.md": kgPasswords,
      "incidentes/caida-auth.md": kgIncidente,
      "notas-de-trabajo.md": kgNotas,
    },
    active: "decisiones/pkce.md",
  },
];
