---
id: VAL-004
type: validation
name: "Versión de formato soportada"
status: active
evidence: declared-doc
summary: "El documento declara versión; versión desconocida impide escribir."
aliases: ["format_version"]
tags: [validacion]
implementation: none
code: []
test_code: []
relations:
  tests: []
  decisions: []
uncertainties:
  - "Nombre del campo de versión (DEC-002)."
  - "P14: solo lectura o exclusión."
---

# VAL-004 · Versión de formato soportada

## Regla
Campo de versión presente en `ai-submind.json` (y donde la spec lo exija). Versión soportada → carga; anterior soportada → aviso y migración explícita; mayor desconocida → error y archivo no escribible.

## Aplica a
ENT-001 y documentos versionados.

## Mensaje / código de error
Error o aviso según caso.

## Ejemplos

| Entrada | Resultado |
|---------|-----------|
| Sin campo de versión | error |
| Versión mayor futura | error, solo lectura o exclusión (P14) |

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Gramática y códigos exactos: spec del formato (PLAN-002 S2).
