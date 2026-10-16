---
name: verify-change
description: Verifica un cambio en ai-submind con evidencia ejecutada - pruebas, validadores, contratos, referencias, contradicciones código/modelo y criterios de aceptación - y registra el resultado real. Usar antes de declarar terminada cualquier tarea T1/T2 o etapa de plan.
---

# verify-change

ID: SKL-006 · Canónico: `AGENTS.md` §6 (fase 5), §12–§13 · Política: `.ai/policies/verification.md`

## Entradas
Descripción del cambio, criterios de aceptación, rango de Git o lista de archivos, plan si existe.

## Procedimiento
1. **Alcance**: `git status --short` y `git diff --stat` (o el rango indicado). Comparar con lo que
   se dijo que se cambió; cualquier archivo inesperado se explica o se revierte (con permiso).
2. **Pruebas del producto**: ejecutar las pertinentes con las herramientas del proyecto
   (`npm test`; las ejecuta también `scripts/check` vía `npm run check`, DEC-008).
3. **Estáticos**: tipos, lint, formato, build, si el stack los tiene.
4. **Validadores**: `scripts/check` (añadir `--strict` al cerrar planes T2).
   Si el cambio tocó código del producto: `scripts/validate-system-model --since <base>`.
5. **Coherencia**: para cada ID tocado, `scripts/sysq show <ID>`; confirmar que la ficha describe
   lo que hace el código ahora. Buscar elementos afectados no actualizados (`scripts/sysq impact <ID>`).
6. **README**: si el cambio altera algo visible para quien usa o clona el repositorio, confirmar que se
   invocó el agente `documenter` (`AGENTS.md` §6, fase 4) y que `README.md` es coherente con el código.
7. **Criterios de aceptación**: uno por uno, con la evidencia que lo cubre o "no cubierto".
8. **Registrar**: comando + resultado (resumen fiel, incluidas fallas) en plan/commit/respuesta.

## Salida
```
Comandos: scripts/check → 0 errores, 3 advertencias (CAP-OPEN ×3, justificadas)
Pruebas: <comando> → N pasan, M fallan (detalle)
Criterios: [✓ C1 (evidencia), ✗ C2 (motivo)]
Estado: implementado | verificado | pendiente | bloqueado
```

## Calidad
Nunca "debería funcionar". Un fallo se reporta tal cual, con salida. Advertencias justificadas o corregidas.

## Límites
Para cambios del entorno o G1+, además pedir revisión independiente al agente `change-verifier`.
