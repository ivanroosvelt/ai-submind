---
id: EDR-001
title: "AGENTS.md como fuente canónica con adaptadores por herramienta"
status: accepted
date: 2026-10-14
affects: [AGENTS.md, CLAUDE.md, .github/copilot-instructions.md, scripts/regen]
supersedes: []
---

# EDR-001 · AGENTS.md como fuente canónica con adaptadores por herramienta

## Contexto
Varios agentes (Claude Code, GitHub Copilot, otros) deben compartir instrucciones sin divergir.
Claude Code admite importar archivos desde `CLAUDE.md` con la sintaxis `@ruta`. Para
`.github/copilot-instructions.md` no se conoce un mecanismo de importación fiable.

## Alternativas consideradas
1. Duplicar reglas en cada archivo — divergencia silenciosa garantizada.
2. Solo mencionar `AGENTS.md` en los adaptadores — no garantiza su carga (la mención no carga el archivo).
3. **Import nativo donde exista; incrustación generada y verificada donde no.**

## Decisión
Alternativa 3. `CLAUDE.md` contiene `@AGENTS.md`. `.github/copilot-instructions.md` contiene
un bloque entre marcadores que `scripts/regen` rellena con `AGENTS.md` (con su sha256);
`scripts/validate-ai-environment` falla si el bloque difiere. Los adaptadores solo añaden lo
específico de su herramienta.

## Consecuencias
- Positivas: una sola fuente; divergencia detectada en CI.
- Negativas: Copilot puede ver `AGENTS.md` dos veces si además lo carga nativamente; cada cambio
  de `AGENTS.md` exige `scripts/regen`.

## Verificación
`scripts/validate-ai-environment` (códigos ENTRY-IMPORT, ADAPTER-MARKERS, GENERATED-STALE).
