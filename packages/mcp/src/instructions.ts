/** Cómo usar la carpeta como memoria; el cliente MCP se lo pasa al agente al conectar (decisión #63). */
export const INSTRUCTIONS = `Esta carpeta es una base de conocimiento persistente: notas .md (y diagramas .flo) enlazadas por relaciones.

Cuándo usarla:
- Antes de decidir o responder sobre el proyecto, busca lo que ya se sabe con query (por typeTag, contextTag o text) y sigue las pistas con get_node.
- Cuando se decida algo, se aprenda algo o pase un incidente, anótalo con write_node.

Antes de escribir:
1. Llama a list_tags y reutiliza los type_tags, context_tags y tipos de relación existentes; crea uno nuevo solo si ninguno sirve.
2. Busca con query si ya hay una nota del tema. Si la hay, actualízala escribiendo en su misma ruta (uri) en vez de crear otra.

Formato de una nota (la primera línea debe ser ---):
\`\`\`markdown
---
id: decision_cache
title: "Decisión: cache de sesiones en Redis"
memory_type: long_term
type_tags: [decision]
context_tags: ["project:core"]
custom_tags: { status: approved }
relations:
  - target: ../decisiones/pkce.md
    type: affects
---
Por qué se decidió, alternativas descartadas y consecuencias.
\`\`\`
- Obligatorios: id (identificador único, sin espacios), title y memory_type: working (la tarea actual), short_term (incidentes, notas de trabajo) o long_term (decisiones, reglas).
- context_tags tienen forma clave:valor; custom_tags son escalares.
- relations.target es la ruta relativa al otro .md (o 'x.flo#bloque'). Un id solo resuelve si su archivo está en use: ["ruta.md"]; si no, es el error E035.
- El cuerpo es markdown libre; los bloques \`\`\`flo dentro de él son diagramas.

write_node no guarda nada que deje errores: si los devuelve, corrige la nota según los diagnósticos y reintenta. check lista los errores del workspace.`;

/**
 * El prompt `map` (#68): guía al agente para volcar un proyecto a la base,
 * con un plan reanudable. En inglés, como todo lo que genera (spec tejo-map §2).
 */
export function MAP_PROMPT(folder: string, scope?: string): string {
  const target = scope?.trim() ? `\`${scope.trim()}\`` : "the whole project";
  return `Map ${target} into the knowledge base at \`${folder}/\`: walk the code and write the notes, relations and flows that represent it. The walk is resumable: the plan and its progress live in \`map-plan.md\`.

With the tejo MCP server, every path (\`path\`, \`uri\`) is relative to the knowledge folder: write \`map-plan.md\`, not \`${folder}/map-plan.md\`.

Naming: file names in kebab-case, ids in snake_case, type_tags and relation types in English. Reuse the existing vocabulary (list_tags) before inventing new tags.

## Phase 0 — Resume
Read \`map-plan.md\` (get_node map_plan, or query). If it exists and has unchecked items (\`- [ ]\`), continue from the first unchecked one: do not re-plan or redo checked items. If every item is checked, the map is finished: say so and ask whether to start a new one (which rewrites the plan).

## Phase 1 — Plan
1. List the files with \`git ls-files\` (it honours .gitignore); without git, list the tree by hand with the same criteria.
2. Exclude what carries no knowledge: dependencies (node_modules, vendor), build output (dist, build, out, target), generated files, lockfiles, binaries and images, snapshots and fixtures, and \`${folder}/\` itself.
3. Group the rest into areas (package, module or subsystem), ordered from what depends on nothing to what depends on everything.
4. Write \`map-plan.md\` before reading code in detail:

~~~markdown
---
id: map_plan
title: "Project map plan"
memory_type: working
type_tags: [plan]
---
Scope: ${scope?.trim() || "whole project"}. Excluded: node_modules, dist, lockfiles.

- [ ] core — packages/core/src
- [ ] cli — packages/cli/src
- [ ] Wrap-up: overview note and check
~~~

## Phase 2 — Walk
For each unchecked area, one at a time:
1. Read the area's code.
2. Call list_tags and query: reuse tags and relation types, and update existing notes at their same path instead of duplicating them.
3. Write one long_term note per relevant component (a unit someone would look for, not one per file): purpose, responsibilities, decisions visible in the code, and the key \`file:line\` references.
4. Relate the notes (part_of, depends_on, calls…, reusing existing types) with relations.target as a relative path.
5. For flows that matter (a request, a pipeline, a lifecycle), add a \`\`\`flo block inside the component's note. Every participant must be declared with \`entity <id>\` in the same block (or in a .flo listed in the note's use:); an undeclared one is error E030.
6. Update the progress right away: rewrite \`map-plan.md\` with the item checked (\`- [x]\`) and a one-line result (notes created or updated) before moving to the next area. If an area is large, split it into sub-items in the plan and check them one by one.

## Phase 3 — Wrap-up
1. Write \`overview.md\` (id project_overview, type_tags: [overview], long_term): a summary of the project linking the notes of each area.
2. Run check and fix until there are no errors.
3. Check the wrap-up item in \`map-plan.md\`.

Example of a component note with a flow:

~~~markdown
---
id: orders_service
title: "Orders service"
memory_type: long_term
type_tags: [component]
---
Creates and stores orders. Entry point: \`src/orders.ts:12\`.

\`\`\`flo
entity api
entity db

flow create_order "Create an order" {
  api -> db : save order
  db -> api : order id
}
\`\`\`
~~~`;
}
