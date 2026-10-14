---
id: VAL-003
type: validation
name: "Integridad referencial de idref"
status: active
evidence: declared-doc
summary: "Toda referencia resuelve a un elemento existente y de tipo compatible con la clave."
aliases: ["idref", "referencia rota"]
tags: [validacion]
implementation: none
code: []
test_code: []
relations:
  tests: []
  decisions: []
uncertainties: []
---

# VAL-003 · Integridad referencial de idref

## Regla
Todo `idref` apunta a un id existente y de tipo compatible (p. ej. extremos de generalización → clase; proveedor de realización → interfaz; eventos de mensaje → occurrence specification; `covered` → lifeline; diagrama de clases → elementos admitidos por su `kind`).

Como los IDs son globales (DEC-003), una referencia a otro modelo es un `idref` simple.

## Aplica a
ENT-002, ENT-003, ENT-004, ENT-005.

## Mensaje / código de error
Severidad error; las referencias rotas se reportan sin bloquear la carga del resto (REQ-036).

## Ejemplos

| Entrada | Resultado |
|---------|-----------|
| Generalización hacia un id inexistente | error |
| `covered` apuntando a una clase | error |

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Gramática y códigos exactos: spec del formato (API-004, §10).
