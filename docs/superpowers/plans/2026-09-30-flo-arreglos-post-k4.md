# .flo — arreglos posteriores a K4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Estado:** completado el 2026-09-30 (`161a297`..`e16081d`).

- Las tres tasks pasaron su revisión sin rondas de fixes.
- Revisión final (whole-branch): lista para mergear con dos minors —
  comentarios de doc desactualizados en
  `packages/core/src/parser/cursor.ts` — corregidos en `e16081d`.
- **Queda** (pre-existente, fuera de alcance de #48): tipear y hacer click
  en un nodo antes de que venzan los 200 ms de debounce todavía
  re-renderiza en el `change` del blur y puede comerse el click; #48 solo
  cubre el caso ya aplicado.

**Goal:** Cerrar los tres pendientes de §11 que un usuario nota:
1. la búsqueda del grafo que pierde texto o se come un click;
2. las aristas `a -> b` repetidas que se dibujan una encima de otra;
3. el `E052`/`E045` de más en un cuerpo de una línea que termina en comentario.

**Architecture:** Tres arreglos independientes, uno por task:
- **Task 1, lexer:** la `}` de cierre de un cuerpo de una sola línea se busca ignorando un comentario final (`Lexer.closeTrailingBraceOnLine`).
- **Task 2, layout:** `layoutFlowchart` pasa a dagre en modo multigrafo, con una arista con nombre por línea del bloque.
- **Task 3, web:** la búsqueda del grafo aplica con debounce en `input`. Un control que no cambia la consulta no re-renderiza, y el re-render vuelve a enfocar la búsqueda que estaba enfocada.

**Tech Stack:** TypeScript 5 (strict), dagre 0.8, Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md` §11, decisiones nuevas **#48–#50** (escritas junto con este plan). Se apoyan en #13, #14, #37 y #45.

| Pendiente de §11 | Task |
|---|---|
| C — `flow a { x -> y } // comentario` da `E016` + `E052` | 1 (#50) |
| C — dos aristas `a -> b` repetidas superpuestas | 2 (#49) |
| K4 — texto de búsqueda perdido por el blur o por la carga de vistas | 3 (#48) |

## Global Constraints

- **Sin dependencias nuevas.**
- **Snapshots de SVG existentes:**
  - No cambian y no se regeneran (`vitest -u` prohibido).
  - La task 2 no agrega snapshots: se testea por puntos y atributos.
  - Se verificó a mano antes de escribir el plan: con multigrafo, los tres snapshots de `reference-diagrams.test.ts.snap` salen idénticos.
- **Sin códigos de diagnóstico nuevos.** La task 1 cambia cuántos diagnósticos salen, no sus códigos ni sus mensajes.
- **Imports relativos con sufijo `.js`** en `packages/core/src/` y `packages/web/src/`.
- **`@flo/web` consume `@flo/core` por `dist/`.** Las tasks 1 y 2 terminan con `pnpm --filter @flo/core build`.
- **Idioma:** comentarios y mensajes en español; nombres de test en inglés.
- **Commits:** uno por task, con la línea final `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Verificación final (desde la raíz):** `pnpm -r typecheck && pnpm -r test && pnpm -r build`.

## Review Focus

1. **Una `}` dentro de un comentario o de una etiqueta:**
   - `flow a { x -> y : a } b } // c` cierra en la última `}`.
   - `flow a { x -> y : ver http://h }` sigue cerrando en su `}`.
   - Un comentario con `\r\n` también cierra.
   - Tests en la task 1.
2. **Dos aristas repetidas con etiquetas distintas** (`a -> b : si` y `a -> b : no`) dan dos recorridos distintos con su etiqueta cada una. Un bloque sin repetidas da exactamente la misma geometría que antes. Tests en la task 2.
3. **Tipear, esperar y hacer click en un nodo:** el blur no re-renderiza, así que el click llega. Test en la task 3.
4. **Tipear mientras terminan de cargar las vistas, o mientras se edita otro documento:** el texto y el foco siguen en la búsqueda, y el texto se aplica al vencer el debounce. Test en la task 3.
5. **Salir del grafo con un debounce pendiente:** no se re-renderiza el grafo sobre el documento. Test en la task 3.

---

## File Structure

`packages/core/src/`:
- Modify `lexer.ts` — `closeTrailingBraceOnLine` ignora un comentario final.
- Modify `parser/document.test.ts` — casos de #50.
- Modify `layout/flowchart.ts` — multigrafo.
- Modify `layout/flowchart.test.ts`, `render/flowchart.test.ts` — casos de #49.

`packages/web/src/`:
- Modify `app.ts` — `applyBar`, debounce de la búsqueda y foco en el re-render.
- Modify `app.test.ts` — casos de #48.

Docs (task 4): §11 del spec (pendientes cerrados) y el estado de este plan.

---

### Task 1: Cuerpo de una línea terminado en comentario (#50)

**Files:**
- Modify: `packages/core/src/lexer.ts` (`closeTrailingBraceOnLine`, ~línea 235)
- Test: `packages/core/src/parser/document.test.ts`

**Interfaces:**
- Produces: `Lexer.closeTrailingBraceOnLine(): boolean`. La firma no cambia; ahora también reconoce `} // comentario` al final de la línea.

- [x] **Step 1: Write the failing tests**

En `packages/core/src/parser/document.test.ts`, junto a "un bloque en una sola línea reporta un solo E016...":

```ts
    it("un bloque en una sola línea con comentario final reporta un solo E016 (#50)", () => {
      const source = "entity x\nflow a { x -> x } // comentario\nflow b {\n  x -> x\n}\n";
      const { diagnostics, document } = parse(source);
      expect(diagnostics.map((d) => d.code)).toEqual(["E016"]);
      expect(document.blocks.map((b) => b.name)).toEqual(["a", "b"]);
    });

    it("un cuerpo de entidad en una sola línea con comentario final reporta un solo E016 (#50)", () => {
      const source = "entity x [X] { type: a } // c\nflow f {\n  x -> x\n}\n";
      const { diagnostics, document } = parse(source);
      expect(diagnostics.map((d) => d.code)).toEqual(["E016"]);
      expect(document.blocks[0].edges).toHaveLength(1);
    });

    it("cierra en la primera '}' seguida solo de un comentario, aunque haya otras antes o dentro de la etiqueta", () => {
      for (const line of [
        "flow a { x -> x : a } b } // c",
        "flow a { x -> x : ver http://h }",
        "flow a { x -> x : ver http://h } // c",
        "flow a { x -> x } // c\r",
      ]) {
        const { diagnostics } = parse(`entity x\n${line}\nentity y\n`);
        expect(diagnostics.map((d) => d.code), JSON.stringify(line)).toEqual(["E016"]);
      }
    });
```

- [x] **Step 2: Run to verify they fail**

Run: `pnpm --filter @flo/core exec vitest run src/parser/document.test.ts`

Expected: FAIL. Hoy los dos primeros casos dan `["E052","E016"]` y `["E045","E016"]`. En el tercero fallan los que tienen comentario.

- [x] **Step 3: Implement**

En `packages/core/src/lexer.ts`, reemplazar el cuerpo de `closeTrailingBraceOnLine` (el guard del buffer queda igual) y actualizar su doc comment:

```ts
  /**
   * Si lo que resta de la línea actual termina en '}' —ignorando espacio en
   * blanco y un comentario `//` final (decisiones #14 y #50)—, descarta los
   * caracteres crudos hasta justo antes de la primera '}' seguida solo de
   * eso (que el próximo next()/peek() tokenizará, y el comentario detrás se
   * lexa como siempre) y devuelve true. Si no, no consume nada y devuelve
   * false. Lo usa el parser para cerrar en la misma línea un cuerpo abierto
   * con contenido detrás del '{'.
   */
  closeTrailingBraceOnLine(): boolean {
    if (this.buffered) {
      throw new Error("Lexer.closeTrailingBraceOnLine: hay un token en el buffer de peek()");
    }
    let j = this.i;
    while (j < this.source.length && this.source[j] !== "\n") j += 1;
    // `[^\n]` y no `.`: `.` no matchea el `\r` de un fin de línea CRLF.
    const match = /\}[ \t\r]*(?:\/\/[^\n]*)?$/.exec(this.source.slice(this.i, j));
    if (!match) return false;
    const k = this.i + match.index;
    while (this.i < k) this.advance();
    return true;
  }
```

Sin comentario, esto se comporta igual que antes: la primera `}` seguida solo de espacio es la última carácter no blanco.

- [x] **Step 4: Run the tests**

Run: `pnpm --filter @flo/core exec vitest run`

Expected: PASS, toda la suite. Si algún test existente de `lexer.test.ts` o `block.test.ts` cambia de resultado, leerlo antes de tocarlo. Solo puede cambiar un caso que tenga `} // ...` al final de una línea con `{`; cualquier otro cambio es un bug de este regex.

- [x] **Step 5: Build y commit**

```bash
pnpm --filter @flo/core typecheck && pnpm --filter @flo/core build
git add packages/core/src/lexer.ts packages/core/src/parser/document.test.ts
git commit -m "fix(core): un cuerpo de una línea puede terminar en comentario"
```

---

### Task 2: Aristas repetidas en un `flow` (#49)

**Files:**
- Modify: `packages/core/src/layout/flowchart.ts` (`layoutFlowchart`)
- Test: `packages/core/src/layout/flowchart.test.ts`, `packages/core/src/render/flowchart.test.ts`

**Interfaces:**
- Produces: `layoutFlowchart(block, catalog)`, misma firma. `edges[i]` corresponde a `block.edges[i]`, y dos aristas con el mismo par tienen `points` distintos.

- [x] **Step 1: Write the failing tests**

En `packages/core/src/layout/flowchart.test.ts`, dentro de `describe("layoutFlowchart", ...)`:

```ts
  it("gives repeated edges between the same pair their own route (#49)", () => {
    const { block, catalog } = firstBlock("entity a\nentity b\nflow f {\n  a -> b : si\n  a -> b : no\n}\n");
    const { edges } = layoutFlowchart(block, catalog);
    expect(edges.map((edge) => edge.label)).toEqual(["si", "no"]);
    expect(edges[0].points).not.toEqual(edges[1].points);
  });
```

En `packages/core/src/render/flowchart.test.ts`, un caso que use el helper de render que ya tenga el archivo (`render(source)` de `./index.js` si no hay otro):

```ts
  it("draws each repeated edge with its own label (#49)", () => {
    const { diagrams } = render("entity a\nentity b\nflow f {\n  a -> b : si\n  a -> b : no\n}\n");
    const svg = diagrams[0].svg;
    const lines = svg.match(/<polyline points="[^"]*"/g) ?? [];
    expect(lines).toHaveLength(2);
    expect(lines[0]).not.toBe(lines[1]);
    expect(svg).toContain(">si<");
    expect(svg).toContain(">no<");
  });
```

- [x] **Step 2: Run to verify they fail**

Run: `pnpm --filter @flo/core exec vitest run src/layout/flowchart.test.ts src/render/flowchart.test.ts`

Expected: FAIL. Los dos recorridos son iguales porque dagre funde la arista.

- [x] **Step 3: Implement**

En `packages/core/src/layout/flowchart.ts`, dentro de `layoutFlowchart`:

```ts
  // Multigrafo (decisión #49): una arista con nombre por línea del bloque,
  // así dos `a -> b` repetidas tienen recorridos propios.
  const graph = new dagre.graphlib.Graph({ multigraph: true });
```

y reemplazar el alta de aristas y su lectura:

```ts
  block.edges.forEach((edge, index) => graph.setEdge(nodeId(edge.from), nodeId(edge.to), {}, String(index)));
```

```ts
    edges: block.edges.map((edge, index) => ({
      from: nodeId(edge.from),
      to: nodeId(edge.to),
      label: edge.label,
      points: graph.edge({ v: nodeId(edge.from), w: nodeId(edge.to), name: String(index) }).points,
      range: edge.range,
    })),
```

Conservar el comentario existente sobre el orden de inserción (nodos primero, aristas después): sigue valiendo.

- [x] **Step 4: Run the whole core suite**

Run: `pnpm --filter @flo/core exec vitest run`

Expected: PASS, y **`reference-diagrams.test.ts` pasa sin escribir ni actualizar snapshots** (`git status` no muestra `.snap` modificados). Si algún snapshot difiere, parar y reportar BLOCKED: no se regenera.

- [x] **Step 5: Build y commit**

```bash
pnpm --filter @flo/core typecheck && pnpm --filter @flo/core build
git add packages/core/src/layout/flowchart.ts packages/core/src/layout/flowchart.test.ts packages/core/src/render/flowchart.test.ts
git commit -m "fix(core): aristas repetidas de un flow con recorrido propio"
```

---

### Task 3: La búsqueda del grafo no pierde texto ni clicks (#48)

**Files:**
- Modify: `packages/web/src/app.ts`
- Test: `packages/web/src/app.test.ts`

**Interfaces:**
- Consumes: `readBar`, `whereOf` (`knowledge-view.ts`); `renderGraph`, `onPreviewChange`, `mode`, `graph` (`app.ts`); en los tests, `KG_FILES`, `graphNodes`, `change`, `click`, `elements`, `withViews` y `presetNames` de `app.test.ts`.
- Produces: el `App` privado `applyBar(): void` y `SEARCH_DEBOUNCE_MS = 200` (constante del módulo `app.ts`).

- [x] **Step 1: Write the failing tests**

En `packages/web/src/app.test.ts`, dentro de `describe("App knowledge graph", ...)` (usa timers falsos):

```ts
  const search = (el: AppElements) => el.preview.querySelector<HTMLInputElement>('[data-flo-kg="text"]')!;

  function type(el: AppElements, value: string): void {
    const input = search(el);
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("applies the search while typing, after the debounce", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    type(el, "pkce");
    expect(graphNodes(el)).toEqual(["pkce", "rule", "api"]); // todavía no
    vi.advanceTimersByTime(200);
    expect(graphNodes(el)[0]).toBe("pkce");
    expect(app.graph.where).toEqual({ and: [{ text: "pkce" }] });
  });

  it("does not re-render when a control leaves the query unchanged, so a click in progress survives", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    type(el, "pkce");
    vi.advanceTimersByTime(200);
    const node = el.preview.querySelector('.flo-kg g[data-flo-entity="pkce"]')!;
    search(el).dispatchEvent(new Event("change", { bubbles: true })); // el blur al ir al nodo
    expect(el.preview.contains(node)).toBe(true);
    click(node.querySelector("text")!);
    expect(app.ws.active).toBe("kb/pkce.md");
  });

  it("keeps focus and unapplied text in the search across a re-render", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    type(el, "regl");
    search(el).setSelectionRange(1, 3);
    app.refresh(); // p. ej. una edición en otro documento
    expect(search(el).value).toBe("regl");
    expect(document.activeElement).toBe(search(el));
    expect([search(el).selectionStart, search(el).selectionEnd]).toEqual([1, 3]);
    vi.advanceTimersByTime(200);
    expect(app.graph.where).toEqual({ and: [{ text: "regl" }] });
    expect(graphNodes(el)[0]).toBe("rule");
  });

  it("keeps the search being typed when the folder's views finish loading", async () => {
    const el = elements();
    const app = new App(el, withViews({ "decisiones.json": JSON.stringify(decisiones) }).snapshot);
    app.toggleGraph();
    type(el, "reg");
    await vi.waitFor(() => expect(presetNames(el)).toEqual(["Vistas", "decisiones"]));
    expect(search(el).value).toBe("reg");
    expect(document.activeElement).toBe(search(el));
  });

  it("drops a pending search when leaving the graph", () => {
    const el = elements();
    const app = new App(el, KG_FILES);
    app.toggleGraph();
    type(el, "pkce");
    app.toggleGraph();
    vi.advanceTimersByTime(200);
    expect(el.preview.querySelector(".flo-kg")).toBeNull();
    expect(app.graph.where).toEqual({ and: [{ text: "" }] });
  });
```

Notas para los tests:
- `withViews`, `decisiones` y `presetNames` ya existen en el `describe` (task 6 de K4). Si están definidos dentro de otro bloque, moverlos al nivel del `describe` o del módulo.
- `vi.waitFor` avanza los timers falsos, así que en el test de las vistas el debounce puede vencer antes o después de que resuelvan. Por eso ese test fija solo el foco y el texto de la búsqueda, no cuándo se aplica.

- [x] **Step 2: Run to verify they fail**

Run: `pnpm --filter @flo/web exec vitest run src/app.test.ts`

Expected: FAIL. No hay listener de `input`, y el re-render pierde el foco y el texto.

- [x] **Step 3: Implement**

En `packages/web/src/app.ts`:

1. Constante del módulo, junto a `NEW_SOURCE`:

   ```ts
   // Mismo debounce que el preview del editor (decisión #48).
   const SEARCH_DEBOUNCE_MS = 200;
   ```

2. Estado: `private searchTimer: ReturnType<typeof setTimeout> | undefined;`

3. En el constructor, junto al listener de `change`:

   ```ts
   el.preview.addEventListener("input", (event) => this.onPreviewInput(event.target as Element));
   ```

4. Métodos:

   ```ts
   /** La búsqueda aplica mientras se escribe, con debounce (#48); los selects, en `change`. */
   private onPreviewInput(target: Element): void {
     if (this.mode !== "graph" || target.getAttribute("data-flo-kg") !== "text") return;
     clearTimeout(this.searchTimer);
     this.searchTimer = setTimeout(() => this.applyBar(), SEARCH_DEBOUNCE_MS);
   }

   /** Lleva la barra a la consulta; si no cambia nada, no re-renderiza (un click en curso sobrevive, #48). */
   private applyBar(): void {
     clearTimeout(this.searchTimer);
     if (this.mode !== "graph") return;
     const { filter, depth } = readBar(this.el.preview);
     const next: GraphQuery = { where: whereOf(filter), from: this.graph.from, depth, viewBox: null };
     const key = (graph: GraphQuery) => JSON.stringify([graph.where, graph.from, graph.depth]);
     if (key(next) === key(this.graph)) return;
     this.graph = next;
     this.refresh();
   }
   ```

5. `onPreviewChange`: las últimas tres líneas (leer la barra, asignar y `refresh`) se reemplazan por `this.applyBar();`. La rama de presets queda igual.

6. `renderGraph`: guardar la búsqueda enfocada antes de reemplazar el HTML y restaurarla después:

   ```ts
   private renderGraph(link: LinkResult): void {
     // Un re-render con la búsqueda enfocada la vuelve a enfocar con su texto (#48).
     const active = document.activeElement;
     const typing =
       active instanceof HTMLInputElement && active.getAttribute("data-flo-kg") === "text" && this.el.preview.contains(active)
         ? { value: active.value, start: active.selectionStart, end: active.selectionEnd }
         : null;
     // ... lo de hoy: query, innerHTML de barra + grafo ...
     if (typing) {
       const input = this.el.preview.querySelector<HTMLInputElement>('[data-flo-kg="text"]');
       if (input) {
         input.value = typing.value;
         input.focus();
         input.setSelectionRange(typing.start, typing.end);
       }
     }
     // ... lo de hoy: svg, viewBox, franjas y pan/zoom ...
   }
   ```

   La restauración va antes del `if (!svg) return;`, así también vale cuando no hay resultados.

7. `load()`: `clearTimeout(this.searchTimer);` junto a los demás reseteos.

- [x] **Step 4: Run the tests**

Run: `pnpm --filter @flo/web exec vitest run && pnpm --filter @flo/web typecheck`

Expected: PASS, incluidos todos los tests previos del grafo. "filters with the bar" usa `change` sobre la búsqueda: sigue aplicando al instante por `applyBar`.

- [x] **Step 5: Commit**

```bash
git add packages/web/src/app.ts packages/web/src/app.test.ts
git commit -m "fix(web): la búsqueda del grafo aplica al escribir y no pierde texto ni clicks"
```

---

### Task 4: Documentación y cierre

**Files:**
- Modify: `docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md` (§11)
- Modify: este plan (línea **Estado**)

- [x] **Step 1: §11**

- En "Pendientes diferidos (Fase C, 2026-09-27)", agregar al final de los bullets **Cualquiera — render** y **Cualquiera — parser** la marca ` Resuelto en 2026-09-30 (#49)` y ` Resuelto en 2026-09-30 (#50)` respectivamente. No se borra nada: §11 solo se agrega.
- En "Pendientes diferidos (Fase K4, 2026-09-30)", en el bullet **Cualquiera — vista de grafo**, agregar al final: `Resuelto en 2026-09-30 (#48): el texto aplica al escribir, un control que no cambia la consulta no re-renderiza y el re-render conserva la búsqueda enfocada.` Si queda una parte sin resolver, la marca dice cuál.

- [x] **Step 2: Estado de este plan**

Debajo del header: `**Estado:** completado el <fecha> (<primer commit>..<último commit>).`, más lo que haya encontrado la revisión, con el formato del plan de K4.

- [x] **Step 3: Verificación completa**

Run: `pnpm -r typecheck && pnpm -r test && pnpm -r build`

Expected: todo en verde, sin `.snap` modificados.

- [x] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-19-flo-entidades-centralizadas.md docs/superpowers/plans/2026-09-30-flo-arreglos-post-k4.md
git commit -m "docs: pendientes de C y K4 resueltos"
```
