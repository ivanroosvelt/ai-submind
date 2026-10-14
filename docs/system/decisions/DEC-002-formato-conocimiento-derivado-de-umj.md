---
id: DEC-002
type: decision
name: "Formato de conocimiento propio derivado de UMJ: un archivo por modelo + layout separado"
status: active
evidence: declared-doc
summary: "UMJ es solo referencia inicial; formato propio versionado, un JSON canónico por modelo y un archivo de layout por diagrama."
aliases: [umj, formato, json-schema, knowledge, layout]
tags: [formato, datos, contratos]
relations:
  affects: [REQ-005, REQ-009, REQ-010, REQ-013, REQ-021, NFR-003, NFR-011, VAL-001, VAL-004, VAL-005, VAL-007, FEAT-003, API-004, ENT-001, ENT-002, ENT-003, ENT-004, ENT-005]
  supersedes: []
uncertainties: []
---

# DEC-002 · Formato de conocimiento propio derivado de UMJ

## Contexto
- Usuario: "estándar JSON bien definido, partiendo de ./UMJ.pdf ... luego se podrá extender a más tipos de diagramas" [declarado].
- Usuario (2026-10-14): "Un archivo por modelo" + "umj solo como referencia inicial, adapta lo mejor posible a la necesidad" [declarado].
- UMJ (Malanowska & Pawłowski, ENASE 2026, DOI 10.5220/0014828700004015): cubre clases y secuencia;
  `id`/`idref`; el modelo es raíz y dueño de las relaciones; `null` = valor desconocido;
  diagramas = conjuntos de referencias, sin layout [verificado: lectura del paper].
- El paper es CC BY-NC-ND 4.0: no se reproduce su texto ni tablas; la especificación se reescribe con
  palabras propias y se cita [verificado: portada del PDF].

## Alternativas consideradas
1. Fragmentado (archivo por elemento) — mejores merges; más archivos y ensamblado.
2. **Un archivo por modelo + layout aparte** — legible y cercano a UMJ; más conflictos si dos ramas tocan el mismo modelo, mitigado con serialización canónica.
3. Un archivo por diagrama — elementos compartidos entre diagramas se complican.

## Decisión
- Formato propio, versionado, con JSON Schema 2020-12 publicado en el paquete. UMJ es la base
  conceptual, no un contrato: se adapta donde convenga y las desviaciones se documentan en la spec.
- Estructura:
  ```
  knowledge/
    ai-submind.json            # manifiesto: versión de formato, nombre y documentación
    models/<model-id>.json     # un modelo: elementos, relaciones, diagramas (refs)
    layout/<diagram-id>.json   # posiciones, tamaños, vértices de enlaces, estilo
    .ai-submind/               # derivados (índices, embeddings, runtime) — en .gitignore
  ```
- Serialización canónica: orden de claves fijo (definido por el schema), arrays de conjuntos
  ordenados por `id`, 2 espacios, LF, salto final, coordenadas enteras. Toda escritura pasa por ella.
- Extensibilidad: tipo de diagrama declarado (`kind`), registro de tipos de elemento por diagrama;
  primer alcance: clases y secuencia.
- Cada archivo declara `format_version` (`MAYOR.MENOR`; primera versión `1.0`).
- La spec propia (con cita a UMJ) vive en `spec/format/` (API-004) y se distribuye con el paquete; `UMJ.pdf` se elimina al terminar PLAN-002.

## Consecuencias
- Positivas: diffs legibles, layout no contamina el modelo, git sigue siendo la fuente de verdad.
- Negativas / costes: conflictos de merge a nivel de archivo de modelo; se compensa con validación
  post-merge (marcadores de conflicto, ids duplicados, refs rotas) y, más adelante, merge driver semántico.

## Elementos afectados
Formato, validador, motor (DEC-004), UI (DEC-006).

## Verificación
Pendiente: ejemplos canónicos del paper reexpresados validan; ida y vuelta lectura→escritura sin diff.
