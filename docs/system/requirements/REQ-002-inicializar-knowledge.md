---
id: REQ-002
type: requirement
name: "Inicializar knowledge/"
status: active
evidence: declared-doc
summary: "ACT-001 o ACT-002 pueden inicializar `knowledge/`"
aliases: ["init"]
tags: [cli]
relations:
  actors: [ACT-001, ACT-002]
  features: [FEAT-001]
  constraints: [VAL-004]
  depends_on: []
  decisions: []
uncertainties:
  - "P10: si la primera escritura MCP inicializa implícitamente."
---

# REQ-002 · Inicializar knowledge/

## Enunciado

ACT-001 o ACT-002 pueden inicializar `knowledge/` para empezar a documentar.

## Fuente

Usuario [U]; supuesto del analista; PLAN-002 S7/S10. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un proyecto sin `knowledge/`, cuando se arranca sin escribir, entonces no se crea nada y las consultas devuelven conjunto vacío.
2. Dado un proyecto sin `knowledge/`, cuando se ejecuta `ai-submind init`, entonces se crea `knowledge/ai-submind.json` con versión de formato y `.ai-submind/` se añade a `.gitignore`.
3. Dado un `knowledge/` existente, cuando se reinicializa, entonces no se sobrescribe ningún archivo.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
