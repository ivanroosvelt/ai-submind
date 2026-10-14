---
name: model-update
description: Crea, actualiza o retira fichas atómicas del modelo estructural de submind (docs/system) con IDs estables, relaciones explícitas, evidencia y rutas de código y pruebas; regenera inventario y trazabilidad y valida. Usar siempre que un cambio afecte a actores, requerimientos, características, entidades, funciones, validaciones, interfaces, integraciones, decisiones o pruebas.
---

# model-update

ID: SKL-004 · Canónico: `AGENTS.md` §7 · Convenciones: `docs/system/conventions.md` · Esquema: `docs/system/schema.yaml`

## Activación
En la misma unidad lógica que el cambio de código o de requerimiento que lo motiva.

## Entradas
IDs afectados (de `impact-analysis`) o elementos nuevos; código y pruebas relacionados.

## Procedimiento

### Crear
1. Comprobar que no existe: `scripts/sysq find <nombre y sinónimos>`.
2. `scripts/sysq claim <PREFIJO>` → ID (queda en el ledger aunque luego no se use: no reutilizar).
3. Copiar la plantilla del tipo desde `docs/templates/` al directorio del tipo indicado en
   `schema.yaml`, como `<ID>-<slug-kebab>.md`.
4. Rellenar front matter: `status` (`proposed` si no está confirmado), `evidence` honesta,
   `implementation` si aplica, `code`/`test_code` solo con rutas que existen (`ruta#símbolo` opcional),
   `relations` solo hacia IDs existentes y con claves permitidas por el esquema.
5. Cuerpo: descripción y secciones de la plantilla. Lo desconocido va en `uncertainties`, no se rellena.

### Actualizar
Editar la ficha para reflejar el **estado vigente** (no añadir historial: eso es Git). Revisar
relaciones salientes y, con `scripts/sysq show <ID>`, las entrantes. Si cambió el comportamiento,
revisar validaciones y pruebas relacionadas y registrar DEC si cambió una decisión.

### Retirar
`status: retired` (o `deprecated` si sigue en uso con reemplazo). Quitar las relaciones que otros
elementos activos tengan hacia él o justificar por qué se mantienen. Nunca borrar la ficha.

### Siempre al final
`scripts/regen` y `scripts/validate-system-model`. Errores: corregir. Advertencias: corregir o justificar.

## Salida
Fichas creadas/actualizadas/retiradas, `scripts/regen` ejecutado, lista de IDs tocados y resultado del validador.

## Calidad
- Un concepto = una ficha. Sin copiar texto entre fichas: referenciar por ID.
- `evidence: verified-code` solo tras leer el código. `implemented` solo si `code` existe.
- No inventar commits: `commits` solo con hashes reales ya existentes.

## Límites
Cambiar `schema.yaml` es G2 (`.ai/policies/governance.md`): requiere DEC/EDR y revisión.
