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
