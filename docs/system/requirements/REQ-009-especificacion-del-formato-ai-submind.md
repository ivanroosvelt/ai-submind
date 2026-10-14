---
id: REQ-009
type: requirement
name: "Especificación del formato ai-submind"
status: active
evidence: declared-doc
summary: "El proyecto debe publicar una especificación propia y versionada del formato, derivada de UMJ y citándolo"
aliases: ["spec", "umj"]
tags: [formato]
relations:
  actors: []
  features: [FEAT-003]
  constraints: [NFR-009, VAL-001]
  depends_on: []
  decisions: []
uncertainties:
  - "P18: ubicación de la spec en el repo y en el paquete."
---

# REQ-009 · Especificación del formato ai-submind

## Enunciado

El proyecto debe publicar una especificación propia y versionada del formato, derivada de UMJ y citándolo.

## Fuente

Usuario [U]; paper UMJ; DEC-002. Propuesta en REP-003 Anexo A.

## Criterios de aceptación

1. La spec cubre los elementos de clases y secuencia del catálogo UMJ que el formato adopte, y documenta las desviaciones.
2. Redactada con palabras propias, sin reproducir tablas, con cita y licencia del paper.
3. Existe un JSON Schema 2020-12 versionado y ejecutable que la implementa.
4. Clases y secuencia en el primer alcance.

## Reglas de negocio

-

## Errores y casos límite

Ver criterios.

## Fuera de alcance

Eliminar `UMJ.pdf` es tarea de cierre de PLAN-002 (S13), no comportamiento del producto.
