# tejo

Base de conocimiento local para tu proyecto y tus agentes: notas `.md` con
frontmatter y diagramas `.flo`, versionadas con el repo, un servidor MCP, una
skill para el agente y un visor web.

```bash
npm i -D tejo        # o usa npx tejo … sin instalar
npx tejo init        # crea knowledge/, .mcp.json, .claude/skills/tejo y el bloque de AGENTS.md
npx tejo view        # abre el visor en http://127.0.0.1:8356
npx tejo check       # lista errores; sale con 1 si hay alguno (útil en CI)
```

Todos los comandos aceptan la carpeta como argumento (por defecto `knowledge`).

- `init` puede correrse otra vez: actualiza solo lo suyo. Si cambias de carpeta, `npx tejo init docs/kb`.
- `mcp` lo arranca el agente desde `.mcp.json`; expone `query`, `get_node`, `list_tags`, `check` y `write_node`.
- `view [--port N] [--no-open]` lee y guarda directamente en la carpeta, y muestra al instante lo que escribe el agente.

Formato de una nota y del lenguaje `.flo`: https://github.com/ivanroosvelt/tejo
