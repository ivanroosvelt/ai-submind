---
id: API-004
type: interface
name: "Formato de conocimiento ai-submind 1.0"
status: active
evidence: declared-doc
summary: "Contrato de archivos de knowledge/: spec spec/format/README.md y JSON Schema 2020-12 en spec/format/schema/1.0/."
aliases: ["formato 1.0", "json schema", "spec del formato", "format_version", "umj"]
tags: [formato, contratos, datos]
implementation: none
code: []
test_code: []
relations:
  providers: []
  consumers: [ACT-001, ACT-002, FEAT-002, FEAT-007]
  entities: [ENT-001, ENT-002, ENT-003, ENT-004, ENT-005]
  validations: [VAL-001, VAL-002, VAL-003, VAL-004, VAL-005, VAL-006, VAL-007]
  tests: []
  decisions: [DEC-002, DEC-003]
uncertainties:
  - "Extensiones fuera de v1.0 (calificadores de asociación, restricciones OCL, nuevos tipos de diagrama) se añadirán como versiones menores o mayores."
---

# API-004 · Formato de conocimiento ai-submind 1.0

## Contrato
Fuente canónica: [`spec/format/README.md`](../../../spec/format/README.md) (semántica) y
[`spec/format/schema/1.0/`](../../../spec/format/schema/1.0/) (estructura y orden de claves:
`defs`, `ai-submind`, `model`, `layout`). Corpus de ejemplos válidos, inválidos y canónicos en
[`spec/format/examples/`](../../../spec/format/examples/README.md). Esta ficha solo enlaza; no repite reglas.

Resumen: manifiesto `knowledge/ai-submind.json`, un archivo por modelo, un layout por diagrama; IDs
legibles en un espacio global (ID de archivo para modelos y diagramas, ID de elemento para el resto);
referencias `{"idref": ...}` entre modelos sin sintaxis adicional; extensiones `stereotypes`, `tags`,
`documentation`, `code_refs`, `external_id`; serialización canónica; códigos de validación estables.

## Operaciones

| Operación | Entrada | Salida | Errores |
|-----------|---------|--------|---------|
| leer / validar `knowledge/` | archivos | documentos cargados + informe `{code, severity, file, pointer, message}` | códigos de la §10.4 de la spec |
| escribir documento | documento válido | archivo en forma canónica (§9) | escritura rechazada si `conflicted`, `invalid_parse` o versión no soportada |

## Autenticación y permisos
No aplica: archivos del repositorio anfitrión; el acceso lo controlan el sistema de archivos y Git.

## Versionado y compatibilidad
`format_version` = `MAYOR.MENOR` en cada archivo. Versión posterior a la soportada → solo lectura
(`FORMAT_VERSION_UNSUPPORTED`); anterior → aviso y migración explícita (spec §11, NFR-011).
