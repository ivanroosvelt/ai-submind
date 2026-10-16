---
name: environment-audit
description: Audita el entorno de IA de ai-submind - agentes, skills, capacidades, cobertura, políticas, adaptadores, validadores y documentación obsoleta - y decide crear, actualizar o retirar componentes con trazabilidad. Usar en el bootstrap, ante capacidades en gap/partial/deferred, duplicidades, fallos repetidos del entorno, cambios de formato de las herramientas o al cerrar un plan T2.
---

# environment-audit

ID: SKL-007 · Canónico: `AGENTS.md` §10 · Políticas: `.ai/policies/lifecycle.md`, `.ai/policies/governance.md`

## Entradas
Motivo de la auditoría y alcance (todo el entorno o componentes concretos).

## Procedimiento
1. **Estado mecánico**: `scripts/validate-ai-environment` y `scripts/validate-system-model`.
   Errores primero.
2. **Inventario**: `.ai/registry/agents-index.md`, `.ai/registry/skills-index.md`, `capabilities.yaml`.
3. **Cobertura**: capacidades `partial`/`gap`/`deferred` → ¿cambió algo que las desbloquee
   (stack elegido, primera integración, datos personales)? Proponer acción concreta.
4. **Duplicidad**: dos componentes con capacidades solapadas o descripciones casi iguales → fusionar
   o registrar el motivo de mantener ambos.
5. **Vigencia**: para cada componente, ¿sus rutas, comandos y reglas citadas existen y siguen
   siendo ciertas? (los validadores comprueban rutas; el contenido lo revisas tú).
   ¿Se usó en los últimos planes? Sin uso + sin capacidad única → candidato a retirar.
6. **Formatos nativos**: si cambió la documentación de Claude Code / Copilot / Agent Skills,
   revisar front matter y ubicaciones; actualizar adaptadores.
7. **Documentación obsoleta**: informes en `docs/reports/current/` superados → archivar;
   planes activos sin movimiento → revisar `next_action` o cancelar con motivo.
8. **Decidir** por hallazgo: G0–G3 (`governance.md`), aplicar lo permitido, EDR para G2+, el resto
   como propuesta.
9. `scripts/regen`, `scripts/check`, y revisión de `change-verifier`.

## Salida
Informe (en la respuesta o en `docs/reports/current/` si es auditoría completa): hallazgos,
acciones aplicadas, propuestas pendientes con su nivel, resultado de validadores.

## Límites
Condición de parada de `AGENTS.md` §10. No auto-aprobar. G3 solo como propuesta.
