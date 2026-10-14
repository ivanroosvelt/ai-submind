# Ciclo de vida de agentes y skills

## Cuándo auditar (skill `environment-audit`)

- Bootstrap del entorno.
- Aparece una perspectiva aplicable cuya capacidad está en `gap`, `partial` o `deferred`.
- Se detecta duplicidad (dos componentes con la misma capacidad sin motivo registrado).
- Una tarea falla dos veces por la misma limitación del entorno.
- Cambian herramientas o formatos nativos (Claude Code, Copilot, Agent Skills).
- Tras una DEC de arquitectura relevante (puede desbloquear capacidades diferidas).
- Auditoría periódica: al cerrar cada plan T2, como mínimo revisar `.ai/registry/capabilities.yaml`.

## Criterios por componente

| Crear | Actualizar | Retirar |
|-------|------------|---------|
| Capacidad **recurrente** no cubrible ampliando uno existente | Cambian responsabilidad, contrato, herramientas, dependencias, criterios o convenciones | Obsoleto, duplicado, incompatible o sin valor |
| Buscar similares (`scripts/sysq find`, índices) y justificar la responsabilidad independiente | Detectada una limitación durante la ejecución | Buscar consumidores (`scripts/sysq show <ID>` muestra menciones) |
| Definir entradas, salidas, límites y verificaciones | Mantener ID; actualizar índices y referencias en la misma operación | Confirmar que sus capacidades quedan cubiertas o pasan a `gap` explícito |

**Agente vs. skill**: skill = procedimiento reutilizable que se ejecuta en el contexto actual.
Agente = contexto aislado con herramientas acotadas; se justifica cuando la tarea es amplia
(mucho material que leer), cuando se necesita independencia (verificación) o cuando conviene
restringir herramientas.

## Procedimiento de cambio

1. `scripts/sysq claim AGT` o `scripts/sysq claim SKL` (solo al crear).
2. Archivo nativo desde la plantilla (`docs/templates/agent.md` o `docs/templates/skill.md`).
   El cuerpo declara `ID: <ID>` y referencia `AGENTS.md`.
3. Registrar en `.ai/registry/components.yaml`; ajustar `.ai/registry/capabilities.yaml`
   y, si cambia una perspectiva, `.ai/registry/coverage.yaml`.
4. Actualizar `AGENTS.md` §5 si cambia la tabla de selección.
5. `scripts/regen` y `scripts/check`.
6. Revisión según `.ai/policies/governance.md`; EDR si es G2+.

## Retirada

- `status: retired` en `components.yaml` (la fila y el ID se conservan para trazabilidad).
- El archivo nativo se elimina para que la plataforma deje de cargarlo; su contenido queda en Git.
  Registrar en la EDR el último commit donde existía (cuando haya commit).
- Quitarlo de `providers` en `capabilities.yaml`; si una capacidad queda sin proveedor activo,
  pasarla a `gap` o `deferred` con nota.
