---
id: ENT-001
type: entity
name: "Configuración del proyecto ai-submind"
status: active
evidence: declared-doc
summary: "Manifiesto knowledge/ai-submind.json con versión de formato y configuración del proyecto."
aliases: ["ai-submind.json", "manifiesto"]
tags: [formato, datos]
implementation: none
code: []
test_code: []
relations:
  related: []
  validations: [VAL-001, VAL-004, VAL-006]
  decisions: []
uncertainties: []
---

# ENT-001 · Configuración del proyecto ai-submind

## Descripción
Documento raíz de `knowledge/`; su presencia indica un directorio inicializado (REQ-002).

## Propiedades

| Propiedad | Tipo | Obligatoria | Restricciones |
|-----------|------|-------------|---------------|
| format_version | texto `MAYOR.MENOR` | sí | VAL-004 |
| name | texto | no |  |
| documentation | texto Markdown | no |  |

## Invariantes
Único por `knowledge/`.

## Persistencia
`knowledge/ai-submind.json`, serialización canónica.

## Ciclo de vida
Creado por `ai-submind init`; nunca sobrescrito al reinicializar.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007. Propiedades indicativas; la definición exacta es la spec y el JSON Schema (API-004).
