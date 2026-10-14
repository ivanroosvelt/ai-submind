# Glosario

Término de dominio → definición breve → ID canónico. La definición completa vive en la ficha;
aquí solo se enlaza. Mantener en orden alfabético.

| Término | Definición breve | ID |
|---------|------------------|----|
| ai-submind (comando) | CLI `npx ai-submind` con `serve`, `mcp`, `init`, `status`, `stop` | API-003 |
| ai-submind.json | Manifiesto de `knowledge/` con versión de formato | ENT-001 |
| API HTTP de la UI | Lectura y escritura solo de layout para la UI | API-002 |
| Búsqueda léxica | Búsqueda por texto libre con ranking léxico | REQ-038 |
| Búsqueda semántica | Búsqueda por similitud con embeddings (posterior) | FEAT-005 |
| Daemon | Proceso único por proyecto que sirve UI y MCP | REQ-037 |
| Diagrama | Vista de un modelo (`kind` clases o secuencia) hecha de referencias | ENT-004 |
| Elemento de modelo | Elemento UML con `id` legible dentro de un modelo | ENT-003 |
| Extensiones del formato | `stereotypes`, `tags`, `documentation`, `code_refs`, `external_id` | API-004 |
| Formato de conocimiento | Formato propio derivado de UMJ con JSON Schema | FEAT-003 |
| Formato 1.0 (spec) | Contrato de archivos de `knowledge/` en `spec/format/` | API-004 |
| ID de archivo / ID de elemento | Gramáticas de ID para modelos y diagramas / resto de elementos, en un espacio global | API-004 |
| idref | Referencia a un elemento por su `id` | VAL-003 |
| Layout | Posiciones y vértices de un diagrama, archivo separado | ENT-005 |
| Modelo | Árbol de elementos, relaciones y diagramas en un archivo | ENT-002 |
| Motor de conocimiento | Equivalente portable propio de TerminusDB | FEAT-002 |
| Proxy MCP stdio | `ai-submind mcp`: reenvía stdio al daemon | REQ-003 |
| Rename | Cambio de `id` con reescritura de referencias | REQ-039 |
| Servidor MCP | Tools MCP de consulta y administración | API-001 |
| Serialización canónica | Escritura determinista para diffs mínimos | REQ-005 |
| UMJ | Formato JSON de intercambio UML de referencia (paper ENASE 2026) | DEC-002 |
| Visor web | UI JointJS para explorar y ajustar layout | FEAT-007 |

Términos del entorno de orquestación (no del producto):

| Término | Significado |
|---------|-------------|
| Ficha | Archivo canónico de un elemento del modelo, con front matter e ID |
| Ledger | Registro append-only de IDs asignados |
| T0/T1/T2 | Clases de tarea según riesgo (`AGENTS.md` §4) |
| G0–G3 | Niveles de impacto de cambios del entorno (`.ai/policies/governance.md`) |
| Capacidad (CAP) | Habilidad que el entorno necesita, provista por agentes/skills |
| EDR | Registro de decisión del entorno de IA |
