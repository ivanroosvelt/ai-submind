---
id: DEC-004
type: decision
name: "Motor de conocimiento propio embebido en lugar de TerminusDB"
status: active
evidence: declared-doc
summary: "Se reimplementa en TypeScript el subconjunto útil de TerminusDB (esquema, grafo de documentos, consultas, diff, control optimista) sobre archivos en knowledge/; git hace de historial."
aliases: [terminusdb, motor, store, grafo, consultas, diff]
tags: [arquitectura, datos]
relations:
  affects: [REQ-006, REQ-007, REQ-008, REQ-011, REQ-017, REQ-018, REQ-019, REQ-022, REQ-026, NFR-005, NFR-007, FEAT-002, FEAT-004, FEAT-008]
  supersedes: []
uncertainties:
  - "Merge semántico a 3 bandas como git merge driver: posterior al MVP."
  - "Lenguaje de consulta de caminos: posterior al MVP."
---

# DEC-004 · Motor de conocimiento propio embebido

## Contexto
- Usuario: "terminusdb para gestión de db/json"; luego: "crea un equivalente portable para gestionar el
  knowledge, con merge de las funcionalidades/validaciones que haremos" [declarado].
- TerminusDB v12.0.8, Apache-2.0, Prolog + Rust; requiere servidor propio [verificado: tech-research].
- Git ya provee commits, ramas, historial y push/pull del proyecto anfitrión [verificado].

## Alternativas consideradas
1. TerminusDB externo (Docker) — funcionalidad completa; rompe portabilidad de `npx`, duplica historial.
2. **Motor propio embebido** — portable, alineado con git; hay que construir y probar.
3. Base embebida genérica (SQLite) — consultas potentes; segundo almacén que sincronizar.

## Decisión
Motor TypeScript en proceso, con `knowledge/` como única fuente de verdad. Subconjunto MVP inspirado
en TerminusDB (estudiado desde su código fuente abierto, no requiere REA):
- Grafo de documentos en memoria cargado desde archivos; índices por tipo, referencias directas e inversas.
- Esquema: validación JSON Schema (Ajv 2020-12) + segunda pasada referencial e invariantes.
- Consultas: por tipo/propiedad, vecinos, referencias inversas, impacto (cierre transitivo), caminos simples.
- Escrituras transaccionales: lote validado completo antes de escribir; control optimista por hash
  de revisión (`@before`-like); escritura atómica (archivo temporal + rename).
- Diff semántico entre revisiones (usado por MCP y validación post-merge).
- Vigilancia de archivos: recarga ante cambios externos (edición manual, checkout, merge).
- No se replica: WOQL/datalog, capas delta, commits/ramas propios.

## Consecuencias
- Positivas: cero infraestructura; git sigue siendo el historial.
- Negativas / costes: rendimiento acotado a memoria (objetivo ~10k elementos por proyecto); mantenimiento propio.

## Elementos afectados
Persistencia (CAP-014 deja de estar diferida), consultas MCP, UI.

## Verificación
Pendiente: pruebas de carga, transacción, conflicto de revisión y recarga externa.
