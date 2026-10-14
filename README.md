# submind

Proyecto en fase inicial: el producto aún no está definido (ver
[docs/system/context.md](docs/system/context.md)).

El repositorio incluye un entorno de desarrollo asistido por IA:

- [AGENTS.md](AGENTS.md) — instrucciones canónicas para cualquier agente (Claude Code, Copilot, …).
- [docs/system/](docs/system/README.md) — modelo estructural del producto (IDs, relaciones, trazabilidad).
- [.ai/](.ai/README.md) — registro de agentes y skills, políticas y decisiones del entorno.

```sh
scripts/check                 # todas las verificaciones (también en CI)
scripts/sysq find <término>   # buscar en el modelo
scripts/regen                 # regenerar índices y adaptadores
```

Requisitos: Python ≥ 3.10 y Git.
