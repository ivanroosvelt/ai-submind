---
id: EDR-005
title: "Catálogo inicial mínimo de agentes y skills"
status: accepted
date: 2026-10-14
affects: [.ai/registry/components.yaml, .ai/registry/capabilities.yaml, .claude/agents/, .claude/skills/]
supersedes: []
---

# EDR-005 · Catálogo inicial mínimo de agentes y skills

## Contexto
Sin producto definido, las necesidades reales y recurrentes son de proceso: analizar tareas,
analizar requerimientos, medir impacto, planificar por etapas, mantener el modelo, registrar
decisiones, verificar y mantener el propio entorno.

## Alternativas consideradas
1. Un agente por cada responsabilidad posible (implementación, datos, API, seguridad, rendimiento…)
   — componentes vacíos sin stack que los concrete; mantenimiento sin valor.
2. **Catálogo mínimo + capacidades no cubiertas declaradas como `partial`/`deferred`.**

## Decisión
Alternativa 2.
- Skills (procedimientos en el contexto actual): `task-intake`, `requirements-analysis`,
  `impact-analysis`, `staged-plan`, `model-update`, `decision-record`, `verify-change`,
  `environment-audit`.
- Agentes (contexto aislado justificado): `requirements-analyst` (análisis amplio),
  `system-modeler` (lotes de fichas), `change-verifier` (independencia; solo lectura),
  `environment-steward` (mantenimiento del entorno).
- No se crean agentes de implementación, datos, API, seguridad ni rendimiento: CAP-011, CAP-014 y
  CAP-015 `deferred`; CAP-009, CAP-010, CAP-012 y CAP-013 `partial`.

## Consecuencias
- Positivas: catálogo pequeño, sin duplicidades, verificable.
- Negativas: al elegir stack habrá que auditar (`environment-audit`) y probablemente especializar
  implementación, pruebas y seguridad.

## Verificación
`scripts/validate-ai-environment` (registro, formato nativo, cobertura); revisión independiente
registrada en REP-002.
