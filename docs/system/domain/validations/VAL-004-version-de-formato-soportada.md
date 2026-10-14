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
uncertainties: []
---

# VAL-004 · Versión de formato soportada

## Regla
Campo de versión presente en `ai-submind.json` (y donde la spec lo exija). Versión soportada → carga; anterior soportada → aviso y migración explícita; posterior a la soportada → `FORMAT_VERSION_UNSUPPORTED`, documento en solo lectura (usuario, 2026-10-14; spec §11).

## Aplica a
ENT-001 y documentos versionados.

## Mensaje / código de error
Error o aviso según caso.

## Ejemplos

| Entrada | Resultado |
|---------|-----------|
| Sin campo de versión | error |
| Versión posterior (`2.0`) | FORMAT_VERSION_UNSUPPORTED, solo lectura |

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Gramática y códigos exactos: spec del formato (API-004, §10).
