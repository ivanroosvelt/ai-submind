# Ejemplos `.flo`

Un archivo por característica del lenguaje. Ver [`docs/SYNTAX.md`](../docs/SYNTAX.md)
para la guía completa.

| Archivo | Qué muestra |
|---|---|
| [`01-flowchart-formas.flo`](01-flowchart-formas.flo) | Las tres formas de nodo (`[ ]`, `{ }`, `( )`) y aristas con etiqueta |
| [`02-flowchart-sin-etiquetas.flo`](02-flowchart-sin-etiquetas.flo) | Aristas sin etiqueta, nodo sin conexiones, referencia antes de declarar |
| [`03-sequence-participantes.flo`](03-sequence-participantes.flo) | `participant ... as ...` con alias de texto libre |
| [`04-sequence-autodeclarado.flo`](04-sequence-autodeclarado.flo) | Participantes autodeclarados desde un mensaje |
| [`05-comentarios.flo`](05-comentarios.flo) | Comentarios `//` antes del header y en línea propia |

Para verlos renderizados, pegá el contenido en el editor de `@flo/web`
(`pnpm --filter @flo/web dev`), o usá `@flo/core` directo:

```ts
import { readFileSync } from "node:fs";
import { render } from "@flo/core";

const source = readFileSync("examples/01-flowchart-formas.flo", "utf-8");
const { svg, diagnostics } = render(source);
```
