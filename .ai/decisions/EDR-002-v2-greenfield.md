---
id: EDR-002
title: "Rama v2 como proyecto nuevo sin relación con la historia previa"
status: accepted
date: 2026-10-14
affects: [docs/system/context.md]
supersedes: []
---

# EDR-002 · Rama v2 como proyecto nuevo sin relación con la historia previa

## Contexto
Al iniciar el bootstrap, `v2` era una rama huérfana sin commits y con el árbol vacío. El usuario
indicó explícitamente: construir sobre `v2` vacía, "sin relación alguna con master", y "comenzamos
nuevo proyecto", sin reutilizar nada anterior.

## Alternativas consideradas
1. Basar `v2` en otra rama existente — descartada por el usuario.
2. **Bootstrap greenfield en `v2`.**

## Decisión
Alternativa 2. Ningún contenido, decisión ni identificador de otras ramas se importa ni se
referencia. La numeración de IDs empieza en 001. Las demás ramas no se modifican ni se borran
(borrarlas es irreversible y requiere autorización explícita aparte).

## Consecuencias
- El producto está sin definir; el modelo estructural arranca vacío (ver `docs/system/context.md`).
- La historia de `v2` empieza con su primer commit.
- Publicación: el usuario autorizó el force push (2026-10-14). Al verificar con `git ls-remote` ya no
  existía `v2` en el remoto (la referencia `origin/v2` local estaba obsoleta), así que bastó un push normal.

## Verificación
`git status` en `v2` al inicio: "No commits yet", árbol vacío (registrado en REP-001).
