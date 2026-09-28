# Ejemplos `.flo`

Dos archivos, uno por tipo de diagrama, ambos modelando el mismo flujo de
compra (carrito, backend, pasarela de pago) para que se puedan comparar
lado a lado. Cada uno compacta todas las características del lenguaje para
ese tipo. Ver [`docs/SYNTAX.md`](../docs/SYNTAX.md) para la guía completa.

| Archivo | Qué muestra |
|---|---|
| [`01-flowchart.flo`](01-flowchart.flo) | Flujo de compra con reintentos de pago. Entidades con las tres formas (`[ ]`, `{ }`, `( )`), un bloque `flow` con título, aristas con y sin etiqueta, comentarios `//` |
| [`02-sequence.flo`](02-sequence.flo) | El mismo flujo como secuencia: frontend, backend, pasarela de pago y su webhook async. Entidades con `type`/`tags` en línea y en cuerpo, una entidad sin forma, dos bloques `sequence` con título sobre las mismas entidades |

En el visor (`@flo/web`) podés abrirlos desde el menú **Ejemplos** de la
toolbar. También podés pegar el contenido a mano
(`pnpm --filter @flo/web dev`), o usar `@flo/core` directo:

```ts
import { readFileSync } from "node:fs";
import { render } from "@flo/core";

const source = readFileSync("examples/01-flowchart.flo", "utf-8");
const { diagrams, diagnostics } = render(source);
```
