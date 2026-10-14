---
name: decision-record
description: Registra decisiones con contexto, alternativas, decisión, consecuencias y elementos afectados - DEC para el producto (docs/system/decisions) y EDR para el entorno de IA (.ai/decisions). Usar cuando se elige entre alternativas con impacto duradero, se cambia una regla, o se supera una decisión previa.
---

# decision-record

ID: SKL-005 · Plantilla: `docs/templates/decision.md`

## Activación
- Producto (DEC): arquitectura, stack, contratos, modelo de datos, reglas de negocio no obvias.
- Entorno (EDR): crear/retirar agentes o skills, cambiar reglas de `AGENTS.md`, políticas,
  esquema o validadores (G2+ de `.ai/policies/governance.md`).
- No registrar decisiones triviales o reversibles sin coste.

## Entradas
Pregunta de decisión, alternativas reales, hechos con fuente, elementos afectados.

## Procedimiento
1. ¿Existe ya? `scripts/sysq find <tema>`; buscar en `.ai/decisions/` y `docs/system/decisions/`.
2. `scripts/sysq claim DEC` o `scripts/sysq claim EDR`.
3. Copiar la plantilla. DEC → `docs/system/decisions/<ID>-<slug>.md` (front matter del modelo,
   relación `affects`). EDR → `.ai/decisions/<ID>-<slug>.md` (front matter EDR de la plantilla).
4. Contexto (hechos con fuente), alternativas reales consideradas, decisión, consecuencias
   (positivas y negativas), elementos afectados, cómo se verificó.
5. Si sustituye otra: nueva con `supersedes`; la anterior pasa a `superseded`/`retired`
   (no se reescribe su contenido).
6. Validar: `scripts/check`.

## Salida
DEC o EDR con estado real (`proposed` hasta aceptación) y referencias cruzadas.

## Calidad
Una decisión por registro. Alternativas no inventadas para rellenar: si no hubo, decirlo.
Estado `proposed` hasta que el usuario o la política aplicable la acepten.

## Límites
No acepta por sí misma decisiones G2+/G3 (`.ai/policies/governance.md`); no reescribe decisiones superadas.
