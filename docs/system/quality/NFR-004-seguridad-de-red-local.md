---
id: NFR-004
type: quality-attribute
name: "Seguridad de red local"
status: active
evidence: declared-doc
summary: "HTTP solo en loopback, token por sesión y validación de Host/Origin."
aliases: ["loopback", "token", "dns rebinding", "origin"]
tags: [seguridad]
relations:
  tests: []
  decisions: []
uncertainties:
  - "Si se admite exponer en otra interfaz con flag explícito."
  - "Cómo recibe el navegador el token (URL de arranque, cookie, cabecera)."
---

# NFR-004 · Seguridad de red local

## Requisito
El daemon escucha solo en 127.0.0.1 (DEC-005); toda petición HTTP/MCP exige el token aleatorio de sesión guardado en `knowledge/.ai-submind/runtime.json` (permisos 0600); se validan `Host` y `Origin` (anti DNS-rebinding); sin CORS abierto.

## Métrica y umbral

| Métrica | Umbral | Cómo se mide |
|---------|--------|--------------|
| Petición con Origin/Host ajeno | rechazada (403) | prueba S7 |
| Petición sin token válido | rechazada | prueba S7 |
| Interfaces de escucha | solo loopback | prueba S7 |

## Alcance
Daemon, API-001 (Streamable HTTP), API-002.

Fuente: REP-003 Anexo A, ajustado a DEC-001..DEC-007.
