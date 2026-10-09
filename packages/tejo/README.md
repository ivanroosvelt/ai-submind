# tejo

**El conocimiento de tu proyecto, tejido en el repo.**

Decisiones, reglas, incidentes y flujos como notas `.md` con frontmatter y
diagramas `.flo`, versionados junto al código y conectados en un grafo que
consultan las personas (en el visor) y los agentes (por MCP).

```bash
npm i -D @ivanroosveltlt/tejo     # o usa npx @ivanroosveltlt/tejo … sin instalar
npx @ivanroosveltlt/tejo init  # crea knowledge/, .mcp.json, las skills tejo y tejo-map y el bloque de AGENTS.md
npx @ivanroosveltlt/tejo view  # abre el visor en http://127.0.0.1:8356
npx @ivanroosveltlt/tejo check # lista errores; sale con 1 si hay alguno (útil en CI)
```

Todos los comandos aceptan la carpeta como argumento (por defecto `knowledge`).

- `init` puede correrse otra vez: actualiza solo lo suyo. Si cambias de carpeta, `npx @ivanroosveltlt/tejo init docs/kb`.
- `mcp` lo arranca el agente desde `.mcp.json`; expone `query`, `get_node`, `list_tags`, `check` y `write_node`, y el prompt `map`.
- `view [--port N] [--no-open]` lee y guarda directamente en la carpeta, y muestra al instante lo que escribe el agente.
- `guide notes|map` imprime las instrucciones vigentes para el agente (las skills lo usan).

## Volcar un proyecto existente

En Claude Code, `/mcp__tejo__map` (o la skill `/tejo-map`) hace que el agente recorra el proyecto y escriba sus notas, relaciones y flows. Primero arma un plan en `knowledge/map-plan.md` y lo marca área por área: si la sesión se corta, el mismo comando sigue donde quedó. `/tejo-map packages/core` limita el recorrido a una ruta.

## Actualizaciones

No hay que hacer nada: `.mcp.json` arranca `@ivanroosveltlt/tejo@latest` y las skills leen sus instrucciones de esa misma versión, así que cada sesión del agente usa lo último (sin red, npx usa la versión de su caché). Si una versión nueva cambia los archivos que escribe `init`, el agente te avisa que corras `npx @ivanroosveltlt/tejo@latest init`; tus notas no se tocan.

Si inicializaste con la 0.1.x, corre `npx @ivanroosveltlt/tejo@latest init` una vez: esa versión no sabe avisar. `npx @ivanroosveltlt/tejo --version` muestra la versión.

Formato de una nota y del lenguaje `.flo`: https://github.com/ivanroosvelt/tejo
