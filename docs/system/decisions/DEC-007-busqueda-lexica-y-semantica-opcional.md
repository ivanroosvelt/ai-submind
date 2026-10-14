---
id: DEC-007
type: decision
name: "Búsqueda léxica siempre disponible y semántica local opcional"
status: active
evidence: declared-doc
summary: "Consultas estructuradas + búsqueda léxica en el núcleo; embeddings locales como módulo opcional; índices derivados fuera de git."
aliases: [busqueda, semantica, embeddings, lexica, consultas]
tags: [consultas, arquitectura]
relations:
  affects: [REQ-016, REQ-020, REQ-038, NFR-002, ACT-004, FEAT-004, FEAT-005]
  supersedes: []
uncertainties:
  - "Modelo de embeddings y si se descarga bajo demanda o se incluye."
---

# DEC-007 · Búsqueda léxica y semántica opcional

## Contexto
- Usuario: consultas inteligentes = "Consultas estructuradas, Búsqueda semántica"; sin LLM embebido [declarado].
- `@huggingface/transformers` 4.3.1 arrastra `onnxruntime-node` (~301 MB); all-MiniLM-L6-v2 cuantizado ~23 MB [verificado: npm].

## Alternativas consideradas
1. Embeddings obligatorios — mejor recall; instalación pesada para `npx`.
2. **Léxica en núcleo + embeddings opcionales** — `npx` liviano; semántica al habilitarla.
3. API externa de embeddings — liviano; requiere red, clave y envía contenido fuera.

## Decisión
- Núcleo: consultas estructuradas sobre el grafo (DEC-004) + búsqueda léxica (BM25 propio o minisearch).
- Módulo opcional de embeddings locales (dependencia opcional, modelo descargado a caché del usuario);
  vector store propio por fuerza bruta (coseno) en `knowledge/.ai-submind/` (ignorado por git),
  invalidado por hash de contenido. Interfaz de proveedor para añadir otros después.
- Búsqueda semántica: posterior al MVP del núcleo.

## Consecuencias
- Positivas: arranque rápido, funciona offline.
- Negativas / costes: semántica requiere paso de instalación adicional.

## Elementos afectados
Consultas MCP, rendimiento (CAP-015).

## Verificación
Pendiente: benchmark de indexado y consulta con corpus de ejemplo.
