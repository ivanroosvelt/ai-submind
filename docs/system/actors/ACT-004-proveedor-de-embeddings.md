---
id: ACT-004
type: actor
name: "Proveedor de embeddings"
status: proposed
evidence: declared-doc
summary: "Módulo local opcional que convierte texto en vectores para la búsqueda semántica (fuera de PLAN-002)."
aliases: ["embeddings", "modelo de embeddings"]
tags: [sistema-externo, posterior]
relations:
  specializes: []
uncertainties:
  - "Modelo de embeddings concreto y si se descarga bajo demanda o se incluye (DEC-007)."
---

# ACT-004 · Proveedor de embeddings

## Descripción
Módulo opcional de embeddings locales con interfaz de proveedor (DEC-007). Solo recibe texto y devuelve vectores.
Fuera de PLAN-002 (búsqueda semántica posterior).

## Objetivos
Habilitar REQ-020.

## Permisos

| Recurso / operación | Permitido | Condiciones |
|---------------------|-----------|-------------|
| Recibir texto de elementos | sí | local, sin red salvo descarga del modelo |
| Escribir en `knowledge/` | no | índices en `knowledge/.ai-submind/` (ignorado por git) |
