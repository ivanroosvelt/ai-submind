---
id: incidente_auth
title: "Incidente: caída de auth"
memory_type: short_term
type_tags: [incident]
context_tags: ["flow:authentication"]
custom_tags:
  severity: 2
relations:
  - target: db
    type: caused_by
  - target: ../decisiones/pkce.md
    type: affects
use: ["../login.flo"]
---

El pool de conexiones a la base se agotó y el login devolvió 500 durante 20 minutos.
