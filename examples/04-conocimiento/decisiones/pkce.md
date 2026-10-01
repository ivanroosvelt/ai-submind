---
id: decision_pkce
title: "Decisión: OAuth2 + PKCE"
memory_type: long_term
type_tags: [decision, architecture]
context_tags: ["project:core", "flow:authentication"]
custom_tags:
  status: approved
relations:
  - target: ../reglas/passwords.md
    type: enforces
  - target: ../login.flo#acceso
    type: visualized_by
  - target: api
    type: affects
---

# OAuth2 + PKCE

El login usa authorization code con PKCE: el cliente no guarda secretos.

```flo
flow pkce "Validación PKCE" {
  api -> auth : validar code_verifier
  auth -> api : refresh token
}
```
