---
id: EDR-003
title: "Validadores en Python sin dependencias con subconjunto YAML propio"
status: accepted
date: 2026-10-14
affects: [scripts/, docs/system/conventions.md]
supersedes: []
---

# EDR-003 · Validadores en Python sin dependencias con subconjunto YAML propio

## Contexto
No hay stack del producto. Las herramientas disponibles en el entorno de desarrollo: Python 3,
Node.js, Git. Los validadores deben funcionar en local y en CI sin instalar paquetes, y no deben
condicionar la futura elección de stack.

## Alternativas consideradas
1. Node.js + paquete YAML — requiere `package.json` y dependencias antes de tener producto.
2. Python + PyYAML — dependencia externa en CI.
3. **Python stdlib + parser de un subconjunto estricto de YAML** (`scripts/smtools/miniyaml.py`).

## Decisión
Alternativa 3. El subconjunto está documentado en `docs/system/conventions.md` y rechaza lo que no
soporta (en vez de interpretarlo mal). Una prueba compara el resultado con PyYAML cuando está instalado.

## Consecuencias
- Positivas: cero dependencias; ejecutable con `python3` ≥ 3.10.
- Negativas: los autores deben respetar el subconjunto (sin `|`, `>`, anclas; comillas si hay `: `).
  Revisar esta decisión si el stack elegido ofrece una alternativa mejor.

## Verificación
`python3 -m unittest discover -s scripts/tests -t scripts` (incluido en `scripts/check`).
