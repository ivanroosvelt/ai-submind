# Modelo estructural del producto

Representación textual, atómica y verificable de **qué es submind**: actores, requerimientos,
características, dominio, interfaces, integraciones, decisiones y pruebas.

- **Estado vigente** aquí; **historia** en Git (`git log -- docs/system/`).
- El **código** es la autoridad sobre el comportamiento implementado; la ficha declara qué fuente
  es autoritativa en su campo `evidence`.
- Convenciones (IDs, nombres, front matter, relaciones, búsqueda): [conventions.md](conventions.md).
- Esquema de tipos y relaciones: [schema.yaml](schema.yaml).

## Por dónde empezar

1. [context.md](context.md) — qué se sabe y qué no del producto.
2. [inventory/INDEX.md](inventory/INDEX.md) — todos los elementos y relaciones (generado).
3. [traceability/MATRIX.md](traceability/MATRIX.md) — REQ → FEAT → elementos → validaciones → pruebas → decisiones (generado).
4. [glossary.md](glossary.md) — términos de dominio → IDs.

## Directorios

| Prefijo | Tipo | Directorio |
|---------|------|------------|
| ACT | actor | [actors/](actors/) |
| REQ | requerimiento | [requirements/](requirements/) |
| NFR | atributo de calidad / requisito no funcional | [quality/](quality/) |
| FEAT | característica | [features/](features/) |
| ENT | entidad de dominio | [domain/entities/](domain/entities/) |
| FUN | función / comportamiento | [domain/functions/](domain/functions/) |
| VAL | validación / regla | [domain/validations/](domain/validations/) |
| API | contrato de interfaz | [interfaces/](interfaces/) |
| INT | integración | [integrations/](integrations/) |
| DEC | decisión del producto | [decisions/](decisions/) |
| TST | prueba o conjunto de pruebas | [quality/tests/](quality/tests/) |

Vista de arquitectura (narrativa, enlaza IDs): [architecture/](architecture/).

## Consultas

```sh
scripts/sysq find <término>   # por nombre, alias, tag, ruta o símbolo
scripts/sysq show <ID>        # ficha + relaciones entrantes/salientes + historial + menciones
scripts/sysq impact <ID>      # qué se rompería al cambiarlo
scripts/sysq claim <PREFIJO>  # reservar el siguiente ID
```
