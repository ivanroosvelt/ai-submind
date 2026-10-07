# tejo — CLI local: conocimiento en el repo, MCP, skill y visor

- **Fecha:** 2026-10-06
- **Rama:** `v2`
- **Estado:** diseño aprobado en chat; pendiente de revisión del spec y de plan
- **Depende de:** `@flo/mcp` (K3, #63), `@flo/web` (K4), decisiones de
  [entidades §11](2026-09-19-flo-entidades-centralizadas.md). Las decisiones
  nuevas se registran como #64–#66 en ese §11.

## 1. Propósito

Que cualquier proyecto pueda instalar la herramienta como dev dependency
(`npm i -D tejo`) o usarla sin instalar (`npx tejo …`) y obtener:

1. una carpeta local, versionada con el repo, que centraliza el conocimiento
   (notas `.md` con frontmatter y diagramas `.flo`);
2. el servidor MCP sobre esa carpeta, registrado para el agente;
3. instrucciones/skill para que un agente lo use sin configurar nada más;
4. el visor/editor web abierto directamente sobre esa carpeta del disco;
5. una verificación de diagnósticos usable en CI.

Éxito: en un repo vacío, `npx tejo init` deja todo listo para Claude Code;
`npx tejo view` abre el visor sobre la carpeta y lo que el agente escribe
aparece en vivo; `npx tejo check` falla con exit 1 si hay errores.

## 2. Renombre del proyecto a tejo

El proyecto pasa a llamarse **tejo**. El **lenguaje sigue siendo `.flo`**:
extensión, bloques ` ```flo `, `data-flo-*`, `.flo/views/`, `GRAMMAR.md`,
`SYNTAX.md` y los snapshots de SVG no cambian.

| Antes | Después |
|---|---|
| `flo-monorepo` (raíz) | `tejo-monorepo` |
| `@flo/core`, `@flo/mcp`, `@flo/web` | `@tejo/core`, `@tejo/mcp`, `@tejo/web` (todos `private`, internos) |
| servidor MCP `flo-mcp`, bin `flo-mcp` | nombre `tejo`; el bin se retira de `@tejo/mcp` (lo reemplaza `tejo mcp`) |
| repo GitHub `ivanroosvelt/submind` | `ivanroosvelt/tejo` (`gh repo rename tejo`, remote actualizado) |
| Pages `…/submind/` | `…/tejo/` |
| README, CLAUDE.md, examples/README | hablan de tejo; el lenguaje sigue llamándose `.flo` |

Los planes y specs ya cerrados (`docs/superpowers/plans/*`, specs
anteriores) son registro histórico: **no se reescriben**.

## 3. Paquete publicable `tejo`

`@tejo/core` y `@tejo/mcp` no se publican. Un paquete nuevo
`packages/tejo` (nombre npm `tejo`, bin `tejo`, `engines.node >=20`) los
**empaqueta dentro**:

- `vite build --ssr src/cli.ts` (Vite ya está en el repo; sin dependencias
  nuevas) produce `dist/cli.js` con shebang. `@tejo/*` se incluyen en el
  bundle (`ssr.noExternal`); `@modelcontextprotocol/sdk`, `zod`, `dagre`,
  `yaml` quedan externos y son `dependencies` de `tejo`.
- El build copia `packages/web/dist` a `packages/tejo/dist/viewer/`.
- `@tejo/core`, `@tejo/mcp` y `@tejo/web` son `devDependencies`
  `workspace:*` de `tejo`, así `pnpm -r build` los compila antes.
- `files: ["dist"]`. Publicar (`npm publish`) queda a cargo del usuario.

## 4. Comandos

Carpeta por defecto: `knowledge`, relativa al directorio actual; todos
aceptan `[carpeta]`. `tejo --help` y un comando desconocido imprimen el uso
(exit 1 en el segundo). Mensajes en español; los avisos del modo MCP van a
stderr.

### 4.1 `tejo init [carpeta]`

Idempotente: correrlo dos veces deja lo mismo. Nunca pisa contenido ajeno.

- Crea `<carpeta>/` si no existe y, solo si no tiene documentos, una nota
  `<carpeta>/bienvenida.md` válida (`check` sin errores) que explica el
  formato.
- `.mcp.json`: lo crea o, si existe, fusiona
  `mcpServers.tejo = { "command": "npx", "args": ["tejo", "mcp", "<carpeta>"] }`
  conservando las demás claves. Un `.mcp.json` que no es JSON válido aborta
  con error sin tocar nada.
- `.claude/skills/tejo/SKILL.md`: se escribe siempre (es de tejo; se
  regenera con la versión instalada). Frontmatter `name: tejo`,
  `description` que dispara antes de decidir/responder sobre el proyecto y
  al anotar decisiones, incidentes o reglas; cuerpo = instrucciones (§5)
  más los comandos `tejo check`/`tejo view`.
- `AGENTS.md`: agrega o reemplaza **solo** el bloque entre
  `<!-- tejo:start -->` y `<!-- tejo:end -->` (resumen corto: dónde está la
  carpeta, que hay un MCP `tejo` y que se consulte antes y se anote después).
- `CLAUDE.md`: si existe y no contiene `@AGENTS.md`, agrega esa línea al
  final. Si no existe, no se crea.
- Imprime qué creó, qué actualizó y qué dejó igual.

### 4.2 `tejo mcp [carpeta]`

El servidor actual de `packages/mcp/src/main.ts` (stdio, watcher, cierre al
terminar stdin), con nombre `tejo`. `main.ts` se reduce a una función
exportada `runMcp(root)` que llama la CLI.

### 4.3 `tejo view [carpeta] [--port N] [--no-open]`

Servidor `node:http` en `127.0.0.1`, **puerto por defecto 8356** ("TEJO" en
el teclado del teléfono). Si está ocupado, error claro sugiriendo
`--port`. Abre el navegador (`open`/`xdg-open`/`start` según plataforma)
salvo `--no-open`; imprime la URL.

- Estáticos de `dist/viewer/` (la raíz `/` es `index.html`; tipos MIME por
  extensión para html/js/css/svg/png/json/woff2).
- `GET /api/files` → `{ root: <nombre de la carpeta>, files: { uri: fuente } }`
  con la misma regla de carga que `FloFolder`.
- `PUT /api/files/<uri>` (cuerpo = fuente) → escribe sin validar (como
  "Guardar" del visor). La uri pasa las mismas comprobaciones de ruta que
  `write_node`: dentro de la raíz, extensión `.flo`/`.md`, sin enlaces
  simbólicos ni directorios ignorados. Error → 400 con `{ error }`.
- `GET /api/events` → SSE; un evento `change` con `{ uri, source | null }`
  (null = borrado) por cada cambio en disco, a partir del watcher de
  `FloFolder` (que gana un callback de cambio).
- **Seguridad:** toda ruta `/api/*` rechaza (403) peticiones cuyo `Host` no
  sea `127.0.0.1:<puerto>`/`localhost:<puerto>` o que traigan un `Origin`
  distinto (anti DNS-rebinding y CSRF). Rutas fuera de `dist/viewer`
  → 404.

### 4.4 `tejo check [carpeta]`

Carga la carpeta, imprime cada diagnóstico como `<uri> ` +
`formatDiagnostic(d)` de core (mismas líneas/columnas que el resto de las
herramientas) y un resumen `N errores en M archivos`. Todo diagnóstico es
un error (#53): exit 1 si hay al menos uno, 0 si no.

## 5. Instrucciones para el agente: una fuente

`INSTRUCTIONS` sale de `tools.ts` a `packages/mcp/src/instructions.ts` y se
exporta. Lo usan el `instructions` del servidor MCP (#63, sin cambios de
texto) y `init` para `SKILL.md`. El test que valida el ejemplo con
`write_node` sigue apuntando a esa constante.

## 6. Visor en modo carpeta local

- `vite.config.ts`: `base: "./"` (rutas relativas), así el mismo build sirve
  en Pages (`/tejo/`) y desde `tejo view` (`/`).
- Al iniciar, la web hace `fetch("api/files")`. Si responde JSON válido,
  arranca en **modo carpeta local**: el workspace es ese mapa (no se
  restaura el borrador de IndexedDB: el disco manda), "Guardar" hace `PUT`
  por cada archivo modificado, "Nuevo" agrega a la carpeta y "Abrir
  carpeta" se oculta. Si falla (Pages, `vite preview`), comportamiento
  actual sin cambios.
- Se suscribe a `api/events`: un cambio en un archivo **no modificado** en
  el editor se aplica (y el borrado lo quita); uno modificado se conserva y
  se avisa una vez con `notify`.
- `WorkspaceSnapshot` gana el destino de guardado del modo local en vez del
  `FileSystemDirectoryHandle`; la lógica de "dirty/guardado" no cambia.

## 7. Pruebas

- `init` sobre un directorio temporal: crea todo; segunda corrida idéntica;
  fusiona un `.mcp.json` existente; respeta texto ajeno de `AGENTS.md` y
  reemplaza solo su bloque; agrega `@AGENTS.md` a un `CLAUDE.md` existente
  una sola vez; `.mcp.json` inválido aborta sin escribir; la nota de
  bienvenida pasa `check`.
- `check`: exit 0 con carpeta válida, 1 con un error, formato de línea.
- Servidor de `view` (puerto 0 en tests): `GET /api/files`, `PUT` válido,
  `PUT` con `../`, extensión ajena o symlink → 400, `Host`/`Origin` ajenos
  → 403, estático y 404, evento SSE al escribir en disco.
- Web: modo local con `fetch`/`EventSource` simulados (carga, guardar,
  cambio externo en archivo limpio y en archivo sucio); sin API, modo
  actual.
- Smoke del paquete: `pnpm --filter tejo pack`, instalar el `.tgz` en un
  directorio temporal con npm y correr `npx tejo init && npx tejo check`
  (script `test:pack`, fuera de `pnpm -r test` porque necesita red/npm).

## 8. Fuera de alcance

- Publicar en npm, versionado/changelog.
- Integraciones específicas de otros agentes (Cursor, Codex) más allá de
  `AGENTS.md` y `.mcp.json`.
- Ejecutar `check` en hooks o pre-commit automáticamente.
- Renombrar el lenguaje `.flo`.

## 9. Decisiones para §11

- **#64** Proyecto renombrado a tejo; el lenguaje sigue siendo `.flo`
  (extensión, bloques, `data-flo-*`, `.flo/views`). Paquetes internos
  `@tejo/*` privados; el único publicable es `tejo`, que empaqueta core y
  mcp con Vite SSR y lleva el visor en `dist/viewer`.
- **#65** CLI `tejo` con carpeta por defecto `knowledge`; `init` es
  idempotente, fusiona `.mcp.json`, regenera `.claude/skills/tejo/SKILL.md`
  y solo toca el bloque `<!-- tejo:start/end -->` de `AGENTS.md`. Las
  instrucciones del agente tienen una sola fuente (`instructions.ts`).
- **#66** `tejo view`: `127.0.0.1:8356`, API `GET/PUT /api/files`, SSE
  `/api/events`, `Host`/`Origin` restringidos a localhost; la web detecta la
  API y entra en modo carpeta local (el disco manda, sin borrador); `base`
  de Vite relativa.
