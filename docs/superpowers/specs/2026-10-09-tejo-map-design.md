# tejo map — volcar un proyecto a su base de conocimiento

- **Fecha:** 2026-10-09
- **Rama:** `master`
- **Estado:** diseño aprobado en chat; pendiente de revisión del spec y de plan
- **Depende de:** CLI `tejo` ([spec](2026-10-06-tejo-cli-design.md), #65,
  #67), instrucciones MCP (#63). La decisión nueva se registra como #68 en
  [entidades §11](2026-09-19-flo-entidades-centralizadas.md).

## 1. Propósito

tejo construye el grafo de conocimiento de dos maneras:

1. **Incremental**: el agente anota decisiones, reglas e incidentes mientras
   trabaja. Ya existe (`INSTRUCTIONS`, #63).
2. **Volcado inicial** (reverse graph creation): el agente recorre un proyecto
   existente y crea las notas, relaciones y flows que lo representan. Es lo
   nuevo.

La CLI no tiene LLM: el recorrido lo hace el agente. El comando `map` es un
**prompt** que el agente ejecuta con las herramientas MCP que ya existen
(`list_tags`, `query`, `get_node`, `write_node`, `check`). No hay código de
análisis nuevo.

Además, un proyecto ya inicializado tiene que poder actualizarse y recibir
las features nuevas (como `map`) de ahora en adelante.

Éxito:

- En Claude Code, `/mcp__tejo__map` o `/tejo-map` hace que el agente
  planifique el recorrido, lo ejecute y deje la carpeta sin errores de
  `check`.
- Una sesión cortada se retoma donde quedó: el progreso se guarda después de
  cada paso.
- Un proyecto inicializado recibe las features nuevas sin hacer nada: el
  servidor y el texto de las skills salen siempre de la última versión. Si
  una versión nueva cambia los archivos que escribe `init`, el agente avisa
  que hay que correrlo.

## 2. El prompt `map`

Una sola fuente: `MAP_PROMPT(folder: string, scope?: string): string` en
`packages/mcp/src/instructions.ts`, exportada desde `@tejo/mcp`. La usan el
prompt MCP y la skill.

`folder` es la carpeta de conocimiento tal como el agente la ve en el
proyecto (`knowledge` por defecto). `scope`, si viene, es una ruta del
proyecto: el recorrido se limita a ella.

El texto le pide al agente cuatro fases, en este orden.

### Fase 0 — Retomar

Leer `<folder>/map-plan.md` (con `get_node` o `query`). Si existe y tiene
ítems `- [ ]` pendientes, seguir desde el primero sin terminar: no replanear
ni rehacer lo marcado. Si todos están marcados, el recorrido terminó:
avisar y preguntar si se quiere un recorrido nuevo (que reescribe el plan).

### Fase 1 — Plan

1. Listar los archivos con `git ls-files` (respeta `.gitignore`); sin git,
   listar el árbol a mano con los mismos criterios.
2. Excluir lo que no aporta conocimiento: dependencias (`node_modules`,
   `vendor`), builds (`dist`, `build`, `out`, `target`), archivos generados,
   lockfiles, binarios e imágenes, snapshots y fixtures, y la propia carpeta
   `<folder>/`.
3. Agrupar lo que queda en **áreas** (paquete, módulo o subsistema), en el
   orden en que conviene leerlas (de lo que no depende de nada a lo que
   depende de todo).
4. Escribir `<folder>/map-plan.md` **antes** de leer código en detalle:

```markdown
---
id: map_plan
title: "Project map plan"
memory_type: working
type_tags: [plan]
---
Scope: whole project. Excluded: node_modules, dist, lockfiles.

- [ ] core — packages/core/src
- [ ] cli — packages/cli/src
- [ ] Wrap-up: overview note and check
```

### Fase 2 — Recorrido

Por cada área pendiente, una a la vez:

1. Leer el código del área.
2. `list_tags` y `query`: reutilizar el vocabulario (`type_tags`,
   `context_tags`, tipos de relación) y actualizar en su misma ruta las notas
   que ya existen en vez de duplicarlas.
3. Escribir una nota `long_term` por componente relevante: propósito,
   responsabilidades, decisiones visibles en el código y los `archivo:línea`
   clave. No una nota por archivo: una por unidad que alguien buscaría.
4. Relacionar las notas (`part_of`, `depends_on`, `calls`, … reutilizando los
   tipos existentes) con `relations.target` por ruta relativa.
5. Para los flujos que importan (una petición, un pipeline, un ciclo de
   vida), un bloque ` ```flo ` dentro de la nota del componente.
6. **Actualizar el progreso enseguida**: reescribir `map-plan.md` con el
   ítem marcado `- [x]` y una línea de resultado (notas creadas o
   actualizadas), antes de pasar a la siguiente área. Si un área es grande,
   partirla en sub-ítems en el plan y marcarlos uno por uno.

### Fase 3 — Cierre

1. Escribir una nota índice (`<folder>/overview.md`, id `project_overview`, `type_tags: [overview]`, `long_term`) que resuma
   el proyecto y enlace las notas de cada área.
2. Correr `check` y corregir hasta que no queden errores.
3. Marcar el ítem de cierre en `map-plan.md`.

### Ejemplo de flow

El prompt trae un ejemplo mínimo de bloque `flo` dentro de una nota:

````markdown
```flo
entity api
entity db

flow create_order "Create an order" {
  api -> db : save order
  db -> api : order id
}
```
````

Un test escribe una nota con este bloque por `write_node` y espera cero
errores (como el ejemplo de #63).

### Idioma y nombres

Todo lo que la feature expone o genera va en inglés y con nombres estándar
(kebab-case en archivos, snake_case en ids): el texto de `MAP_PROMPT` y de la
skill, el argumento `scope`, los archivos `map-plan.md` y `overview.md`, sus
ids (`map_plan`, `project_overview`), sus tags (`plan`, `overview`), los
ítems del plan y el ejemplo de flow. El prompt le pide al agente el mismo
criterio para las notas que escribe: archivos en kebab-case, ids en
snake_case, tags y tipos de relación en inglés. Los mensajes de la CLI, los
comentarios del código y este spec siguen en español (CLAUDE.md).
`INSTRUCTIONS` y la nota `bienvenida.md` quedan como están: traducirlas es
otro cambio.

## 3. Cómo se invoca

- **Prompt MCP**: `createServer` registra
  `server.registerPrompt("map", { title, description, argsSchema: { scope: z.string().optional() } }, …)`.
  Devuelve un mensaje de usuario con `MAP_PROMPT(folder, scope)`, donde
  `folder` es la ruta de la carpeta servida relativa al directorio de trabajo
  del proceso, ambos con `realpath` (`FloFolder.root` ya lo es). En Claude
  Code aparece como `/mcp__tejo__map`.
- El texto aclara que con MCP las rutas (`uri`) son relativas a la carpeta
  (`map-plan.md`, no `<folder>/map-plan.md`), y que sin MCP se editan los
  archivos de `<folder>/` y se valida con `npx @ivanroosveltlt/tejo check`.
- **Skill**: `tejo init` escribe también `.claude/skills/tejo-map/SKILL.md`
  (`name: tejo-map`; en Claude Code, `/tejo-map`), una skill mínima que lee
  el texto con `tejo guide map` (§4). El `scope` se le pasa al agente en el
  mismo mensaje (`/tejo-map packages/core`) y la skill lo traduce a
  `--scope`.
- El bloque de `AGENTS.md` suma una línea: para volcar el proyecto a la base,
  el prompt MCP `map` o la skill `tejo-map`.

## 4. Actualización automática

El texto vive solo en el paquete; en el repo no queda nada con versión.

- **`.mcp.json` sigue a la última versión**: `mcpServers.tejo = npx -y
  @ivanroosveltlt/tejo@latest mcp <carpeta>`. Cada sesión del agente arranca
  el servidor más nuevo, con sus instrucciones y prompts. Verificado con npm
  10.9.8: con la caché caliente arranca en ~4 s (≈ igual que una versión
  fija) y sin red usa la versión de la caché.
- **`tejo guide <topic> [carpeta] [--scope ruta]`** imprime el texto vigente:
  `notes` → `INSTRUCTIONS`, `map` → `MAP_PROMPT(carpeta, scope)`. Un topic
  desconocido es error (exit 1).
- **Skills mínimas**: `.claude/skills/tejo/SKILL.md` y
  `.claude/skills/tejo-map/SKILL.md` ya no copian el texto; le piden al agente
  correr `npx -y @ivanroosveltlt/tejo@latest guide notes|map <carpeta>` (con
  `--scope <ruta>` si el pedido nombra una) y seguir lo que imprime. Conservan
  la sección "sin el servidor MCP" (`check`, `view`). Su contenido solo cambia
  si cambia la forma de las skills, no el texto.
- **Aviso de archivos desactualizados**: `tejo mcp` compara, antes de
  arrancar, los archivos que `init` escribiría (las skills, la entrada
  `tejo` de `.mcp.json` y el bloque de `AGENTS.md`; no `CLAUDE.md` ni la nota
  de bienvenida) con los del disco. Si alguno difiere o falta, suma a las
  instrucciones del servidor, en inglés: los archivos desactualizados y que
  se le pida a la persona correr `npx @ivanroosveltlt/tejo@latest init
  <carpeta>`. La comparación es local (no consulta el registro). Si la
  carpeta no está dentro del cwd o la comparación falla, no hay aviso.
  El servidor nunca escribe esos archivos por su cuenta.
- **Migración única desde 0.1.x**: su `.mcp.json` dice `npx -y
  @ivanroosveltlt/tejo mcp …` sin `@latest`, y npx sigue usando la 0.1.x de
  la caché, que no sabe avisar. Hay que correr `npx
  @ivanroosveltlt/tejo@latest init` una vez; el README lo dice.
- `tejo --version` (y `-v`) imprime la versión.

Descartado: fijar la versión en `.mcp.json` (obliga a actualizar a mano) y
que el servidor reescriba las skills al arrancar (modifica el repo sin que
nadie lo pida).

## 5. Decisión #68

> **Prompt `map` y actualización automática.** Enmienda a #63: el servidor
> MCP registra un prompt, `map` (argumento opcional `scope`), que guía el
> volcado de un proyecto a la base (plan reanudable en `map-plan.md`,
> recorrido por áreas con el progreso actualizado tras cada una, nota
> `overview.md`, `check`). Su texto, en inglés como todo lo que genera, tiene
> una sola fuente: `MAP_PROMPT` de `@tejo/mcp`. Enmienda a #65/#67:
> `.mcp.json` registra `npx -y @ivanroosveltlt/tejo@latest mcp <carpeta>`;
> las skills `tejo` y `tejo-map` son mínimas y leen el texto vigente con
> `tejo guide notes|map`; `tejo mcp` avisa en sus instrucciones si los
> archivos de `init` están desactualizados, sin escribirlos. `tejo --version`
> imprime la versión.

## 6. Tests

- `@tejo/mcp`:
  - el servidor lista el prompt `map`; `getPrompt` con y sin `scope`
    devuelve un texto que nombra la carpeta y, si viene, el `scope`;
  - la nota de ejemplo con flow pasa por `write_node` sin errores;
  - `createServer` con un aviso extra lo suma a las instrucciones.
- `tejo`:
  - `init` escribe las dos skills mínimas y `.mcp.json` con `@latest`; un
    `.mcp.json` de 0.1.x queda actualizado; dos corridas dan "sin cambios";
  - `guide notes` imprime `INSTRUCTIONS`; `guide map knowledge --scope x`
    imprime `MAP_PROMPT("knowledge", "x")`; un topic desconocido sale con 1;
  - el aviso: vacío tras `init`, lista los archivos tras borrar una skill o
    con un `.mcp.json` viejo, vacío si la carpeta está fuera del cwd;
  - `--version` imprime la versión y sale con 0.
