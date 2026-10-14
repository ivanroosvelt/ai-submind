---
id: EDR-004
title: "Relaciones declaradas en origen, índices generados y ledger de IDs"
status: accepted
date: 2026-10-14
affects: [docs/system/schema.yaml, docs/system/conventions.md, scripts/regen, scripts/sysq]
supersedes: []
---

# EDR-004 · Relaciones declaradas en origen, índices generados y ledger de IDs

## Contexto
El modelo debe permitir navegar relaciones en ambos sentidos, detectar referencias rotas y
huérfanos, y no duplicar información. Los IDs no deben reutilizarse nunca.

## Alternativas consideradas
1. Relaciones bidireccionales escritas a mano — duplicación y divergencia.
2. Grafo central mantenido a mano — segunda fuente de verdad.
3. **Relación en una sola dirección canónica (definida por `schema.yaml`); inversas calculadas;
   inventario y matriz generados y verificados; ledger append-only de IDs.**

## Decisión
Alternativa 3. `scripts/sysq` calcula entrantes, cierre transitivo e impacto. `scripts/regen`
genera `inventory/INDEX.md` y `traceability/MATRIX.md`; los validadores fallan si están desactualizados.
El ledger (`docs/system/inventory/id-ledger.txt`, `.ai/registry/id-ledger.txt`) registra todo ID
asignado; las fichas se retiran, no se borran.

## Consecuencias
- Positivas: una fuente por relación; búsqueda determinista y completa respecto del inventario.
- Negativas: hay que ejecutar `scripts/regen` tras tocar fichas (lo exige CI).

## Verificación
`scripts/validate-system-model`; pruebas en `scripts/tests/test_model.py`.
