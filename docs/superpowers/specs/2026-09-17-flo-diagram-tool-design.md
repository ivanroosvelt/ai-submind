# `.flo` — réplica de Mermaid: formato propio + editor web

- **Fecha:** 2026-09-17
- **Rama:** `v2` (proyecto nuevo, sin relación con el compilador `.sub` de `master`)
- **Estado:** parcialmente reemplazado por
  [2026-09-19-flo-entidades-centralizadas.md](2026-09-19-flo-entidades-centralizadas.md),
  que sustituye la fila "Gestión de archivos" de §2, la sintaxis de §4 y las
  exclusiones de §8. El resto de este documento sigue vigente.

## 1. Propósito

Construir un reemplazo de Mermaid: un formato de diagramas propio (sintaxis
nueva, gramática formal y no ambigua), con su propio parser/validador, un
motor de render a SVG, y un editor web de texto + preview en vivo para
crear y modificar los archivos. Prioridad: intuitivo y simple primero,
completo (más tipos de diagrama) después, en fases.

## 2. Decisiones de alcance

Tomadas durante la sesión de brainstorming:

| Pregunta                           | Decisión                                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gestión de archivos                | Tooling propio (parser/linter/formateador). Sin registro central ni base de datos de diagramas — cada archivo es autocontenido, como un `.md` suelto. |
| Relación con `submind`/`.sub`      | Ninguna. Proyecto independiente, dominio distinto.                                                                                                    |
| Alcance de tipos de diagrama (MVP) | Flowchart + secuencia. Otros tipos (estados, ER, clases) quedan fuera de este plan.                                                                   |
| Modelo del editor                  | Texto con preview en vivo (split-pane), no WYSIWYG/canvas.                                                                                            |
| Persistencia                       | Solo navegador, sin backend ni cuentas. File System Access API + fallback de carga/descarga.                                                          |
| Reusabilidad del motor             | Sí — `core` se publica como paquete npm independiente del editor, embebible en otros sitios.                                                          |
| Compatibilidad con Mermaid         | Ninguna. Formato 100% nuevo, sin importador.                                                                                                          |

## 3. Arquitectura

Monorepo con pnpm workspaces, dos paquetes:

- **`@flo/core`** — sin dependencia de framework de UI.
  - `lexer` — tokens con línea/columna.
  - `parser` — recursive-descent, produce un AST tipado. Nodo raíz `Diagram`
    con `kind: "flowchart" | "sequence"` y cuerpo específico por tipo, para
    poder agregar tipos nuevos después sin tocar el lexer/parser genérico.
  - `diagnostics` — errores/warnings estructurados (código, línea, columna,
    mensaje, fix sugerido cuando aplica), no strings sueltos.
  - `layout` — wrapper sobre `dagre` para flowchart; layout de columnas
    (sin librería externa) para secuencia.
  - `render` — AST + layout → SVG.
  - Expone `parse(source)` y `render(source)` como API pública, publicable
    a npm de forma independiente del editor.
- **`@flo/web`** — vanilla TypeScript + Vite, consume `@flo/core`. Sin
  React/Vue: es un editor de texto + panel de preview, no un dashboard de
  componentes.

## 4. Diseño de la sintaxis

Nombre de trabajo del formato: **`.flo`** (cambiable).

```
diagram flowchart

start[Inicio]
check{¿Login válido?}
home[Mostrar home]
error[Mostrar error]

start -> check
check -> home : sí
check -> error : no
```

```
diagram sequence

participant user as Usuario
participant api as API
participant db as Base de datos

user -> api : POST /login
api -> db : SELECT usuario
db -> api : fila
api -> user : 200 OK
```

Principios que hacen la gramática no ambigua (a diferencia de Mermaid):

- **Header uniforme:** todo diagrama arranca con `diagram <tipo>` — un solo
  mecanismo de declaración de tipo para todos los tipos de diagrama.
- **Gramática determinista:** un statement por línea, sin heurísticas de
  texto para clasificar líneas. Bloques anidados (subgrafos, loops de
  secuencia) usan `{ }` en vez de indentación significativa o un `end`
  genérico ambiguo al anidar.
- **Nodos declarados una vez con su forma** (`[rect]`, `(redondeado)`,
  `{decisión}`), reusados por id en las aristas. Redeclarar el mismo id con
  otra forma es un error de compilación, no un diagrama silenciosamente raro.
- **Comentarios uniformes:** `//` en todos los tipos de diagrama.

La gramática formal completa (EBNF) para flowchart y secuencia es un
entregable de la Fase 1, no de este documento — este spec fija los
principios y el nivel de ambición, no la gramática letra por letra.

## 5. Manejo de errores

- Cada error trae código, línea:columna, mensaje humano y, cuando aplica,
  un fix sugerido.
- El parser tiene recuperación de errores: sigue leyendo tras un error y
  junta todos los errores de la pasada en una sola corrida, como un
  compilador real — no muere en el primer error como Mermaid.
- El editor pinta los errores inline (subrayado + tooltip). El preview
  sigue mostrando el último diagrama válido renderizado más un banner
  "N errores" en vez de una pantalla en blanco.

## 6. Editor web

- Split-pane: CodeMirror 6 (modo de sintaxis `.flo` propio, diagnósticos
  del core pintados inline) a la izquierda, preview SVG en vivo a la
  derecha, actualizado con debounce (~200ms).
- Barra superior: Abrir, Guardar, Exportar (SVG/PNG), "Nuevo" (flowchart /
  secuencia) que inserta el header base.
- Persistencia: File System Access API donde esté disponible (Chrome/Edge)
  para abrir/guardar in-place; fallback de `<input type=file>` + descarga
  en navegadores sin esa API. Autosave a IndexedDB como red de seguridad,
  independiente del archivo real en disco.
- Cero backend, cero cuentas. Build estático desplegable como archivos
  planos en cualquier hosting o servible localmente.

## 7. Testing

- `@flo/core`: suite exhaustiva de lexer/parser (Vitest) — tabla de casos
  válidos (snapshot del AST) e inválidos (snapshot de los diagnósticos
  exactos esperados). Es la prueba central de "sintácticamente correcto".
- Snapshots del SVG generado sobre un set fijo de diagramas de referencia,
  como regresión visual básica (detectar cambios no intencionales, no
  pixel-perfect).
- `@flo/web`: integración ligera con Playwright — escribir sintaxis,
  verificar que el preview se actualiza y los errores aparecen; probar
  abrir/guardar con la File System Access API simulada.
- CI corre toda la suite + build de ambos paquetes en cada push.

## 8. Fuera de alcance (explícito)

- Backend, cuentas, almacenamiento compartido o multi-archivo gestionado.
- Importador o modo de compatibilidad con sintaxis Mermaid.
- Tipos de diagrama más allá de flowchart y secuencia (estados, ER, clases,
  Gantt, mindmap, etc.) — quedan como fases futuras, no planificadas aquí.
- Motor de auto-layout propio — se reusa `dagre`.
- Editor visual/WYSIWYG (canvas de arrastrar nodos).

## 9. Fases y entregables

**Fase 0 — Setup del monorepo**

- pnpm workspace con `@flo/core` y `@flo/web` como paquetes vacíos.
- Vitest, tsconfig, build (`tsc`/`vite build`) y CI configurados y
  corriendo en verde en cada push, aunque todavía no haya lógica.

**Fase 1 — Lenguaje: lexer + parser + AST**

- Gramática formal (EBNF) para flowchart y secuencia, documentada.
- Lexer y parser implementados para ambos tipos, con recuperación de
  errores y diagnósticos estructurados.
- AST tipado (`Diagram` con `kind` discriminado).
- Suite de tests de lexer/parser (casos válidos e inválidos) en verde.
- Verificable sin render: parsear archivos `.flo` de ejemplo y obtener AST
  o diagnósticos correctos (por test o CLI mínima).

**Fase 2 — Layout + render a SVG**

- Integración de `dagre` para flowchart; layout de columnas para secuencia.
- `render(ast) -> svgString` funcionando para ambos tipos.
- Tests de snapshot visual sobre un set de diagramas de referencia.
- `@flo/core` queda con `parse()` + `render()` end-to-end, publicable a
  npm (sin publicar todavía).

**Fase 3 — Editor web (MVP)**

- `@flo/web`: split-pane con CodeMirror 6 + preview en vivo (debounce).
- Modo de sintaxis `.flo` en CodeMirror con diagnósticos inline.
- Build estático servible (`npx serve dist` o equivalente).

**Fase 4 — Persistencia y exportación**

- Abrir/Guardar con File System Access API + fallback de carga/descarga.
- Autosave a IndexedDB.
- Exportar a SVG/PNG.
- Menú "Nuevo" (flowchart / secuencia) con header base insertado.

**Fase 5 — Pulido, publicación y documentación**

- `@flo/core` publicado en npm.
- README con ejemplos de sintaxis y de uso de la librería.
- Deploy público del editor (ej. GitHub Pages / Vercel estático).
- Documentación de la sintaxis orientada a usuario final (distinta de la
  gramática formal interna de la Fase 1).

**Futuro (fuera de este plan, no planificado en detalle):** más tipos de
diagrama, importador opcional desde Mermaid, backend opcional para
compartir/colaborar.
