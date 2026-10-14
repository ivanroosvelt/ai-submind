<!--
Plantilla común para decisiones.
- Producto (DEC): usar el front matter A en docs/system/decisions/DEC-NNN-<slug>.md
- Entorno (EDR): usar el front matter B en .ai/decisions/EDR-NNN-<slug>.md
Borrar el bloque que no se use y este comentario.
-->
---
# A · Producto
id: DEC-XXX             # scripts/sysq claim DEC
type: decision
name: "<título de la decisión>"
status: proposed        # proposed | active (aceptada) | deprecated | retired (sustituida)
evidence: declared-doc
summary: "<una línea>"
aliases: []
tags: []
relations:
  affects: []
  supersedes: []
uncertainties: []
---
---
# B · Entorno
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
