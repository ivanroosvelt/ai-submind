# Convenciones del modelo estructural

## Identificadores

- Formato `PREFIJO-NNN` (tres dígitos o más): `REQ-001`, `FEAT-012`. Prefijos en `schema.yaml`.
- Únicos, permanentes, independientes de nombre, ubicación u orden. Nunca se reutilizan.
- Todo ID asignado figura en el ledger append-only `inventory/id-ledger.txt`
  (entorno: `.ai/registry/id-ledger.txt`). Reservar siempre con `scripts/sysq claim <PREFIJO>`.

## Archivos

- Una ficha por elemento: `<directorio del tipo>/<ID>-<slug>.md`; `slug` en kebab-case, sin tildes.
- Renombrar el slug está permitido (el ID no cambia); mover de tipo no: se retira y se crea otro.
- `README.md` e `INDEX.md` de cada directorio no son fichas.

## Front matter

Subconjunto de YAML (lo valida `scripts/smtools/miniyaml.py` sin dependencias):
mapas y listas en bloque, listas en línea `[A, B]`, escalares, `{}` vacío, comentarios `#`.
No se admiten `|`, `>`, anclas, ni cadenas sin comillas que contengan `: ` (usar comillas).
Las fechas (`2026-10-14`) se leen como texto ISO, no como objetos fecha. Dentro de listas en línea,
los elementos con apóstrofo deben ir entre comillas dobles (`["l'x", b]`).

Campos comunes (obligatorios en negrita):

| Campo | Valores |
|-------|---------|
| **id** | `PREFIJO-NNN` |
| **type** | el de `schema.yaml` para el prefijo |
| **name** | nombre canónico (término de dominio) |
| **status** | `proposed` · `active` · `deprecated` · `retired` |
| **evidence** | `verified-code` · `declared-doc` · `inferred` · `unknown` |
| summary | una línea |
| aliases | sinónimos y términos alternativos (para `sysq find`) |
| tags | etiquetas libres en kebab-case |
| implementation | solo tipos implementables: `none` · `partial` · `implemented` · `verified` |
| code | rutas de implementación: `ruta` o `ruta#símbolo` (deben existir) |
| test_code | rutas de pruebas: `ruta` o `ruta#símbolo` (deben existir) |
| relations | mapa `clave: [IDs]` con claves permitidas por el tipo |
| uncertainties | lista de dudas abiertas |
| commits | hashes reales relevantes (nunca inventados) |

Reglas comprobadas: `implemented`/`verified` exigen `code`; `verified` exige pruebas alcanzables
(un TST o `test_code`, propio o de los elementos que relaciona); `evidence: verified-code` exige `code` o `test_code`.

## Relaciones

- Se declaran **solo en el origen**, con la dirección canónica de `schema.yaml`
  (p. ej. `REQ.features → FEAT`, nunca `FEAT.requirements`). Las inversas se calculan.
- Inventario de relaciones: una línea `ORIGEN clave DESTINO` en `inventory/INDEX.md`,
  buscable con `grep "FEAT-001" docs/system/inventory/INDEX.md`.

## Términos de dominio y símbolos de código

- El término canónico es el `name`; sinónimos en `aliases`; el glosario apunta término → ID.
- Los símbolos de código se enlazan desde la ficha (`code: [src/x.ts#crearUsuario]`).
  Opcionalmente, el código puede citar el ID en un comentario (`// FUN-004`) para búsqueda inversa;
  `scripts/sysq show <ID>` lista esas menciones.

## Búsqueda (completa respecto del inventario)

| Pregunta | Comando |
|----------|---------|
| ¿Existe algo llamado X? | `scripts/sysq find X` |
| Definición, relaciones, código, pruebas, historial y menciones de un ID | `scripts/sysq show ID` |
| ¿Qué se rompe si cambio ID? | `scripts/sysq impact ID` |
| Todo lo de un tipo | `scripts/sysq list PREFIJO` |
| Texto libre | `rg -n "término" docs/system` |

## Estado vigente vs. historia

La ficha describe el presente. No añadir secciones de historial: usar `git log -p -- <ficha>`.
Las decisiones que cambian comportamiento se registran como DEC y se enlazan por `relations`.
