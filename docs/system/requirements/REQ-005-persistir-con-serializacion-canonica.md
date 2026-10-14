---
id: REQ-005
type: requirement
name: "Persistir con serialización canónica"
status: active
evidence: declared-doc
summary: "ai-submind debe escribir `knowledge/` con serialización canónica"
aliases: ["canonico", "determinista"]
tags: [datos]
relations:
  actors: []
  features: [FEAT-002, FEAT-003]
  constraints: [NFR-003]
  depends_on: []
  decisions: []
uncertainties: []
---

# REQ-005 · Persistir con serialización canónica

## Enunciado

ai-submind debe escribir `knowledge/` con serialización canónica para que Git muestre diffs mínimos.

## Fuente

Usuario [U]; DEC-002. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. Dado un documento sin cambios lógicos, cuando se guarda, entonces queda byte a byte idéntico.
2. Dado un cambio en un elemento, cuando se guarda, entonces el diff afecta solo a ese elemento y a las referencias necesarias.
3. UTF-8, 2 espacios, LF, salto final, orden de claves por schema, conjuntos ordenados por `id`, coordenadas enteras.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

-
