# Arquitectura

Vista narrativa de la arquitectura: componentes, capas, dependencias y despliegue. **No duplica
fichas**: describe la estructura y enlaza IDs (FEAT, API, INT, DEC).

Estado: **stack fijado, sin funcionalidad** (ver [../context.md](../context.md)). Paquete npm único
`ai-submind` (DEC-001, DEC-008): módulos en `src/<módulo>/` (format, engine, query, cli, daemon, mcp, ui),
pruebas en `test/`, `code_roots: [src/]` en [../schema.yaml](../schema.yaml). Proceso daemon + proxy MCP
(DEC-005). Diagrama de componentes: se añade cuando existan módulos (PLAN-002 S4+).
