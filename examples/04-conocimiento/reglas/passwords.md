---
id: regla_passwords
title: "Regla: contraseñas"
memory_type: long_term
type_tags: [business_rule]
context_tags: ["project:core"]
relations:
  - target: auth
    type: affects
use: ["../login.flo"]
---

Mínimo 12 caracteres; se guardan con argon2id, nunca en texto plano.
