<!--
Plantilla común para decisiones (idioma según EDR-007).
- Producto (DEC, en inglés): front matter A + cuerpo A en docs/system/decisions/DEC-NNN-<slug>.md
- Entorno (EDR, en español): front matter B + cuerpo B en .ai/decisions/EDR-NNN-<slug>.md
Borrar los bloques que no se usen y este comentario.
-->
---
# A · Product (DEC)
id: DEC-XXX             # scripts/sysq claim DEC
type: decision
name: "<decision title>"
status: proposed        # proposed | active (accepted) | deprecated | retired (superseded)
evidence: declared-doc
summary: "<one line>"
aliases: []
tags: []
relations:
  affects: []
  supersedes: []
uncertainties: []
---

# <ID> · <title>

## Context
Facts with their source.

## Alternatives considered
1. … — pros / cons

## Decision

## Consequences
- Positive:
- Negative / costs:

## Affected elements

## Verification
How it was checked (commands, reviews).

---
# B · Entorno (EDR)
id: EDR-XXX             # scripts/sysq claim EDR
title: "<título de la decisión>"
status: proposed        # proposed | accepted | superseded | deprecated
date: AAAA-MM-DD
affects: []             # rutas o IDs de agentes/skills/políticas
supersedes: []
---

# <ID> · <título>

## Contexto
Hechos con su fuente.

## Alternativas consideradas
1. … — pros / contras

## Decisión

## Consecuencias
- Positivas:
- Negativas / costes:

## Elementos afectados

## Verificación
Cómo se comprobó (comandos, revisiones).
