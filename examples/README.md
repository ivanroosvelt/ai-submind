# Ejemplos `.flo`

Tres archivos y una carpeta. Los dos primeros modelan el mismo flujo de compra
(carrito, backend, pasarela de pago), uno como flowchart y otro como
secuencia, para compararlos lado a lado. El tercero muestra la idea central
del lenguaje: un catálogo de entidades compartido por un `flow` y un
`sequence` en el mismo archivo. Entre los tres cubren todas las
características del lenguaje. Ver [`docs/SYNTAX.md`](../docs/SYNTAX.md) para
la guía completa.

| Archivo | Qué muestra |
|---|---|
| [`01-flowchart.flo`](01-flowchart.flo) | Flujo de compra con reintentos de pago. Entidades con las tres formas (`[ ]`, `{ }`, `( )`), un bloque `flow` con título, aristas con y sin etiqueta, comentarios `//` |
| [`02-sequence.flo`](02-sequence.flo) | El mismo flujo como secuencia: frontend, backend, pasarela de pago y su webhook async. Entidades con `type`/`tags` en línea y en cuerpo, una entidad sin forma, dos bloques `sequence` con título sobre las mismas entidades |
| [`03-catalogo.flo`](03-catalogo.flo) | Un login como `flow` y como `sequence` sobre las mismas entidades. Cuerpo de entidad sin forma (`entity auth {`), cuerpo vacío (`{}`), entidad usada antes de declararse, bloque sin título (el preview muestra su nombre) |
| [`04-conocimiento/`](04-conocimiento) | Una carpeta con notas `.md` de conocimiento sobre un `login.flo`: `knowledge.schema.yaml`, los tres `memory_type`, tags, relaciones a una nota, a un bloque y a una entidad, y un bloque `flo` embebido. Está en **Ejemplos** como "Grafo de conocimiento" (o ábrela con **Abrir carpeta**); toca **Grafo** |

En el visor (`@flo/web`) puedes abrirlos desde el menú **Ejemplos** de la
toolbar, que importa estos mismos archivos. También puedes pegar el contenido a mano
(`pnpm --filter @flo/web dev`), o usar `@flo/core` directo:

```ts
import { readFileSync } from "node:fs";
import { render } from "@flo/core";

const source = readFileSync("examples/01-flowchart.flo", "utf-8");
const { diagrams, diagnostics } = render(source);
```
