# Plantillas

| Plantilla | Uso | Destino |
|-----------|-----|---------|
| actor.md, requirement.md, quality-attribute.md, feature.md, entity.md, function.md, validation.md, interface.md, integration.md, test.md | Fichas del modelo | directorio del tipo en `docs/system/schema.yaml` |
| decision.md | DEC (producto) y EDR (entorno) | `docs/system/decisions/`, `.ai/decisions/` |
| plan.md | Planes por etapas | `docs/plans/active/` |
| report.md | Informes | `docs/reports/current/` |
| agent.md, skill.md | Componentes del entorno | `.claude/agents/`, `.claude/skills/<nombre>/SKILL.md` |

Siempre reservar el ID con `scripts/sysq claim <PREFIJO>` antes de copiar.
Los validadores ignoran este directorio; `scripts/tests/` comprueba que las plantillas de fichas
generan fichas válidas.
