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
- `npx @ivanroosveltlt/tejo@latest init` en un proyecto inicializado con una
  versión anterior deja el servidor MCP y las skills en la versión nueva sin
  tocar las notas.

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
  (`name: tejo-map`; en Claude Code, `/tejo-map`) con `MAP_PROMPT(folder)`.
  El `scope` se le pasa al agente en el mismo mensaje
  (`/tejo-map packages/core`); la skill lo dice en una línea.
- El bloque de `AGENTS.md` suma una línea: para volcar el proyecto a la base,
  el prompt MCP `map` o la skill `tejo-map`.

## 4. Versionado y actualización

Hoy `init` registra `npx -y @ivanroosveltlt/tejo mcp <carpeta>` sin versión:
npx reutiliza lo que tiene en caché y un proyecto puede quedarse con el
servidor viejo; las skills nuevas solo llegan si se vuelve a correr `init`.

- `init` **fija la versión**: `mcpServers.tejo = npx -y
  @ivanroosveltlt/tejo@<versión> mcp <carpeta>`. La versión sale del
  `package.json` del paquete (mismo mecanismo que `tools.ts`). El servidor y
  las skills de un proyecto quedan siempre en la misma versión.
- **Actualizar** = `npx @ivanroosveltlt/tejo@latest init [carpeta]`. Como
  `init` es idempotente, regenera las skills (y crea las nuevas), el bloque
  de `AGENTS.md` y la versión de `.mcp.json`; las notas no se tocan. Una
  entrada vieja sin versión se reemplaza.
- `init` termina imprimiendo cómo actualizar.
- `tejo --version` (y `-v`) imprime la versión.
- El README documenta "Actualizar".

Fuera de alcance: que el servidor avise de una versión nueva. Se agrega si
actualizar a mano resulta un problema.

## 5. Decisión #68

> **Prompt `map` y versión fijada.** Enmienda a #63: el servidor MCP registra
> un prompt, `map` (argumento opcional `scope`), que guía el volcado de un
> proyecto a la base (plan reanudable en `map-plan.md`, recorrido por
> áreas con el progreso actualizado tras cada una, nota índice, `check`).
> Su texto tiene una sola fuente, `MAP_PROMPT` de `@tejo/mcp`, que también
> usa la skill `.claude/skills/tejo-map/SKILL.md` que escribe `init`.
> Enmienda a #65/#67: `init` fija la versión del paquete en `.mcp.json`
> (`@ivanroosveltlt/tejo@<versión>`); actualizar es correr
> `npx @ivanroosveltlt/tejo@latest init`. `tejo --version` imprime la
> versión.

## 6. Tests

- `@tejo/mcp`:
  - el servidor lista el prompt `map`; `getPrompt` con y sin `scope`
    devuelve un texto que nombra la carpeta y, si viene, el `scope`;
  - la nota con el ejemplo de flow pasa por `write_node` sin errores.
- `tejo` (`init`):
  - escribe `.claude/skills/tejo-map/SKILL.md`;
  - `.mcp.json` lleva `@ivanroosveltlt/tejo@<versión del package.json>`;
  - un `.mcp.json` con la entrada vieja sin versión queda actualizado;
  - correr `init` dos veces deja todo en "sin cambios".
- `tejo` (CLI): `--version` imprime la versión y sale con 0.
