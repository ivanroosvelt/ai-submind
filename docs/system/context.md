# Contexto del producto

> Clasificación de cada afirmación: **[verificado]** en código · **[declarado]** en documentación o
> por una persona · **[inferido]** con evidencia parcial · **[desconocido]**.

## Qué se sabe

- Nombre del repositorio: `submind` **[verificado]** (remoto de Git). Nombre del producto, paquete npm,
  comando y servidor MCP: `ai-submind` (DEC-001) **[declarado]**.
- Rama de trabajo `v2` iniciada sin historia (EDR-002) **[declarado]**.
- Propósito: gestor de diagramas (clases y secuencia en el primer alcance) que vive en `knowledge/` del
  proyecto anfitrión, versionado con Git como única fuente de verdad; agentes lo consultan y administran vía
  MCP y personas lo exploran en una UI web (REQ-001..040, REP-003) **[declarado]**.
- Actores: ACT-001 Desarrollador, ACT-002 Agente IA (cliente MCP), ACT-003 Repositorio Git anfitrión;
  ACT-004 Proveedor de embeddings (posterior) **[declarado]**. Usuario único local, sin roles **[inferido]**.
- Stack: Node.js ≥22, TypeScript estricto, ESM, distribuido con `npx ai-submind`; raíz = git root del cwd (DEC-001) **[declarado]**.
- Formato: propio, derivado de UMJ, JSON Schema 2020-12, un archivo por modelo
  (`knowledge/models/<model-id>.json`), layout separado (`knowledge/layout/<diagram-id>.json`), manifiesto
  `knowledge/ai-submind.json`, derivados en `knowledge/.ai-submind/` ignorados por git; serialización canónica (DEC-002, FEAT-003) **[declarado]**.
- Contrato del formato 1.0: `spec/format/README.md` + JSON Schema 2020-12 en `spec/format/schema/1.0/` + corpus de
  ejemplos (API-004). Schemas compilados con Ajv 8 en modo estricto; corpus comprobado con un prototipo desechable
  (PLAN-002 S2); validador definitivo en S4 **[declarado]**.
- IDs de elementos legibles con ámbito (`Car`, `Car.start()`), únicos en un espacio global (también modelos y
  diagramas), estables al cambiar `name`; referencias entre modelos con `idref` simple; rename solo vía motor con
  reescritura de referencias (DEC-003, REQ-039, API-004) **[declarado]**.
- Versión de formato posterior a la soportada → documento en solo lectura (VAL-004, NFR-011) **[declarado]**.
- Motor de conocimiento propio embebido en lugar de TerminusDB (DEC-004, FEAT-002) **[declarado]**.
- Proceso: daemon único por proyecto (HTTP en 127.0.0.1, token, Host/Origin) + proxy MCP stdio
  `ai-submind mcp` (DEC-005, FEAT-001, REQ-037) **[declarado]**.
- UI: `@joint/core` con shapes propias; explorar y ajustar layout; cambios de modelo solo vía MCP
  (DEC-006, FEAT-007; secuencia en FEAT-009, PLAN-002 S11) **[declarado]**.
- Búsqueda: estructurada + léxica en el núcleo (FEAT-004); semántica con embeddings posterior y fuera de
  PLAN-002 (DEC-007, FEAT-005) **[declarado]**.
- Interfaces: API-001 servidor MCP, API-002 API HTTP de la UI, API-003 CLI **[declarado]**.
- No existe código del producto ni pruebas: todo elemento implementable tiene `implementation: none` **[verificado]**.
- Escala objetivo ~10 000 elementos por proyecto (NFR-007, umbrales sin confirmar) **[inferido]**.

## Qué no se sabe (pendiente)

- Paquete único vs monorepo, framework de pruebas y `code_roots` (PLAN-002 S3) **[desconocido]**.
- Apagado del daemon, entrega del token al navegador, puerto por defecto (DEC-005, NFR-004) **[desconocido]**.
- Si el agente MCP puede modificar layout (P9), init implícito (P10) **[desconocido]**.
- Licencia de ai-submind **[desconocido]**.

## Próximo paso

PLAN-002 S3 (andamiaje del paquete TypeScript, pruebas y `code_roots`).
