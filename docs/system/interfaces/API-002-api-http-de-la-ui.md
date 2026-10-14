---
id: API-002
type: interface
name: "API HTTP de la UI"
status: active
evidence: declared-doc
summary: "API HTTP local que sirve la UI: lectura de modelos y diagramas, escritura solo de layout, eventos en vivo."
aliases: ["http", "api ui", "sse"]
tags: [contratos]
implementation: none
code: []
test_code: []
relations:
  providers: []
  consumers: [ACT-001]
  entities: [ENT-002, ENT-004, ENT-005]
  validations: [VAL-005]
  tests: []
  decisions: []
uncertainties:
  - "SSE vs WebSocket para refresco en vivo (S9)."
---

# API-002 · API HTTP de la UI

## Contrato
Endpoints HTTP del daemon en 127.0.0.1 consumidos por la UI JointJS; canal de eventos (SSE o WebSocket) para refresco en vivo (REQ-030). Rechaza toda escritura que no sea layout (REQ-032).

## Operaciones

| Operación | Entrada | Salida | Errores |
|-----------|---------|--------|---------|
| leer modelos/diagramas/elemento | ids | JSON | NOT_FOUND |
| estado de validación | - | hallazgos |  |
| guardar layout | diagram id, layout, revisión | nueva revisión | REVISION_CONFLICT, VAL-005 |
| eventos | - | stream de cambios |  |

## Autenticación y permisos
Loopback, token y validación Host/Origin (NFR-004).

## Versionado y compatibilidad
Interna: UI y API se distribuyen juntas en el paquete; sin garantía de compatibilidad externa.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Nombres de operaciones indicativos; se fijan en la etapa correspondiente del plan.
