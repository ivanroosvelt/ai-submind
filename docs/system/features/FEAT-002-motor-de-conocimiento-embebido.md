---
id: FEAT-002
type: feature
name: "Motor de conocimiento embebido"
status: active
evidence: declared-doc
summary: "Equivalente portable propio de TerminusDB sobre knowledge/: carga, grafo, transacciones, revisión, rename, recarga."
aliases: ["motor", "store", "terminusdb", "almacen"]
tags: [datos, motor]
implementation: none
code: []
test_code: []
relations:
  entities: [ENT-001, ENT-002, ENT-003, ENT-004, ENT-005]
  functions: []
  interfaces: []
  integrations: []
  depends_on: [FEAT-003]
  decisions: []
uncertainties:
  - "Merge semántico a 3 bandas y lenguaje de caminos: posteriores (DEC-004)."
---

# FEAT-002 · Motor de conocimiento embebido

## Descripción
Motor TypeScript en proceso (DEC-004): grafo de documentos en memoria e índices, escrituras transaccionales validadas, control optimista, escritura atómica, rename con reescritura de referencias, watcher y diff semántico. Git es el historial. PLAN-002 S5.

## Comportamiento
REQ-005..008, REQ-022, REQ-026 (transacción), REQ-039.

## Estados y transiciones
Documento: `valid` · `valid_with_warnings` · `invalid_parse` · `invalid_schema` · `conflicted` · `unsupported_version`; solo los dos primeros admiten escrituras; todo cambio en disco revalida.

## Dependencias
FEAT-003 (formato y validación).

## Riesgos
Rendimiento acotado a memoria (NFR-007); mantenimiento propio.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
