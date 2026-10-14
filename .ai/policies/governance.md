# Gobierno del entorno de IA

Complementa `AGENTS.md` §10–§11. Define **quién puede aprobar qué**.

## Niveles de impacto de un cambio del entorno

| Nivel | Ejemplos | Requisitos para aplicarlo |
|-------|----------|---------------------------|
| G0 cosmético | Erratas, redacción sin cambio de regla | `scripts/check` en verde |
| G1 operativo | Nuevo paso en un skill, nueva advertencia en un validador, nueva plantilla | `scripts/check` en verde + revisión de `change-verifier` (o persona) + nota en el commit |
| G2 normativo | Cambiar una regla de `AGENTS.md`, crear/retirar agente o skill, cambiar `schema.yaml` o un validador de forma que acepte lo que antes rechazaba | G1 + EDR registrada (o DEC si es del modelo del producto) |
| G3 sensible | Seguridad, permisos (`.claude/settings*.json`), aprobaciones, secretos, CI, capacidad de borrar datos, desactivar o relajar validadores | G2 + **aprobación humana explícita** en la conversación o PR |

## Reglas

1. Un agente no puede ser el único verificador de su propio cambio (G1+).
2. Relajar un validador para que pase un cambio es G3, no G1.
3. Sin aprobación humana, un cambio G3 se deja como **propuesta** (plan en `docs/plans/active/`
   con estado `blocked` y `blockers` explícitos).
4. Toda EDR enumera los componentes afectados y cómo se verificó.
5. Límite anti-bucle: ver `AGENTS.md` §10 (condición de parada).

## Registro

- Decisiones del entorno: `.ai/decisions/` (plantilla `docs/templates/decision.md`).
- Cambios en sí: Git. Las EDR enlazan commits solo cuando existen.
