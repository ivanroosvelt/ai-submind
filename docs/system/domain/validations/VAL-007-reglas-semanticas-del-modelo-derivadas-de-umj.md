---
id: VAL-007
type: validation
name: "Reglas semánticas del modelo derivadas de UMJ"
status: active
evidence: inferred
summary: "Invariantes semánticas: dirección de asociación, orden de fragmentos y propiedad de las relaciones."
aliases: ["umj", "invariantes"]
tags: [validacion]
implementation: none
code: []
test_code: []
relations:
  tests: []
  decisions: []
uncertainties: []
---

# VAL-007 · Reglas semánticas del modelo derivadas de UMJ

## Regla
Asociación dirigida va del primer al segundo extremo; el orden del array de eventos de una interacción es significativo y no se reordena; las relaciones pertenecen al modelo raíz y los paquetes solo guardan referencias (derivado de UMJ, adaptable según DEC-002). En agregación y composición `end1` es el todo. Desviaciones respecto de UMJ: spec §12.

## Aplica a
ENT-002, ENT-003.

## Mensaje / código de error
Severidad error.

## Ejemplos

| Entrada | Resultado |
|---------|-----------|
| Paquete que contiene una asociación propia | error |
| Reordenar fragmentos al serializar | prohibido |

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Gramática y códigos exactos: spec del formato (API-004, §10).
