---
id: ACT-003
type: actor
name: "Repositorio Git anfitrión"
status: active
evidence: declared-doc
summary: "Sistema pasivo que altera knowledge/ (checkout, pull, merge) y puede dejar conflictos."
aliases: ["git", "repositorio", "merge", "checkout"]
tags: [sistema-externo]
relations:
  specializes: []
uncertainties: []
---

# ACT-003 · Repositorio Git anfitrión

## Descripción
Git del proyecto anfitrión: es el historial de `knowledge/` (DEC-004). No invoca a ai-submind; sus operaciones
cambian archivos en disco y ai-submind debe detectarlas (REQ-007, REQ-034..036).

## Objetivos
Conservar la evolución del conocimiento junto al código.

## Permisos

| Recurso / operación | Permitido | Condiciones |
|---------------------|-----------|-------------|
| Modificar archivos de `knowledge/` | sí (externo) | ai-submind revalida y no repara en silencio |
